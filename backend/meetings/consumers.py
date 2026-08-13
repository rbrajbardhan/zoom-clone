import json
import re
import datetime
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Meeting

# Meeting ID format validation regex (alphanumeric and hyphens only)
MEETING_ID_REGEX = re.compile(r'^[a-zA-Z0-9-]+$')

# Module-level dictionary to track transient room details:
# ROOMS = { room_group_name: { "host_channel_name": str, "host_display_name": str, "participants": { channel_name: display_name } } }
ROOMS = {}

class MeetingConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.meeting_id = self.scope['url_route']['kwargs']['meeting_id']

        # Validate meeting ID format before DB lookup
        if not MEETING_ID_REGEX.match(self.meeting_id):
            await self.close(code=4000)
            return

        status_val = await self.get_meeting_status(self.meeting_id)
        if status_val is None:
            await self.close(code=4004)
            return
        if status_val in [Meeting.Status.COMPLETED, Meeting.Status.CANCELLED]:
            await self.close(code=4003)
            return

        sanitized_id = re.sub(r'[^a-zA-Z0-9_.-]', '', self.meeting_id)
        self.room_group_name = f"meeting_{sanitized_id}"

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()
        
        self.display_name = None
        self.is_host = False

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

            if self.room_group_name in ROOMS:
                room_state = ROOMS[self.room_group_name]
                room_state["participants"].pop(self.channel_name, None)

                if room_state["host_channel_name"] == self.channel_name:
                    room_state["host_channel_name"] = None
                    room_state["host_display_name"] = None

                    if room_state["participants"]:
                        new_host_channel = next(iter(room_state["participants"]))
                        new_host_display = room_state["participants"][new_host_channel]
                        
                        room_state["host_channel_name"] = new_host_channel
                        room_state["host_display_name"] = new_host_display

                        # Broadcast host handoff to the room
                        await self.channel_layer.group_send(
                            self.room_group_name,
                            {
                                "type": "host_changed_event",
                                "meeting_id": self.meeting_id,
                                "display_name": new_host_display,
                            }
                        )

                if not room_state["participants"]:
                    ROOMS.pop(self.room_group_name, None)

            # Only broadcast leave if this connection had identified itself
            if getattr(self, 'display_name', None) is not None:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "participant_left_event",
                        "meeting_id": self.meeting_id,
                        "display_name": self.display_name,
                        "sender_channel_name": self.channel_name,
                    }
                )

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        msg_type = data.get("type")
        
        if msg_type == "identify":
            display_name = data.get("display_name")
            
            # Display name validation and sanitization
            if not isinstance(display_name, str):
                await self.close(code=4003)  # Reject with custom close code for invalid format
                return
            
            display_name = display_name.strip()
            if not display_name or len(display_name) > 100:
                await self.close(code=4003)  # Reject with custom close code for invalid/blank/overlong
                return
            
            self.display_name = display_name

            room_state = ROOMS.setdefault(self.room_group_name, {
                "host_channel_name": None,
                "host_display_name": None,
                "participants": {}
            })

            room_state["participants"][self.channel_name] = self.display_name

            # First identified participant becomes host
            is_host = False
            if room_state["host_channel_name"] is None:
                room_state["host_channel_name"] = self.channel_name
                room_state["host_display_name"] = self.display_name
                is_host = True

            self.is_host = is_host

            # Update scheduled meeting to active on first participant join
            await self.activate_meeting_if_scheduled()

            # Broadcast join to all peers in the room (including sender, so they learn their own host status)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "participant_joined_event",
                    "meeting_id": self.meeting_id,
                    "display_name": self.display_name,
                    "is_host": is_host,
                    "host_display_name": room_state["host_display_name"],
                    "sender_channel_name": self.channel_name,
                }
            )

        elif msg_type == "signal":
            # Block signal messages from unidentified peers
            if getattr(self, 'display_name', None) is None:
                return

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "signal_event",
                    "signal_type": data.get("signal_type"),
                    "data": data.get("data"),
                    "sender_channel_name": self.channel_name,
                }
            )

        elif msg_type == "chat_message":
            # Reject messages from unidentified connections
            if getattr(self, 'display_name', None) is None:
                await self.close(code=4003)
                return

            message = data.get("message")

            if not isinstance(message, str):
                await self.send(text_data=json.dumps({
                    "type": "chat_error",
                    "error": "Invalid message format."
                }))
                return

            message_stripped = message.strip()
            if not message_stripped:
                await self.send(text_data=json.dumps({
                    "type": "chat_error",
                    "error": "Message cannot be empty."
                }))
                return

            if len(message_stripped) > 1000:
                await self.send(text_data=json.dumps({
                    "type": "chat_error",
                    "error": "Message is too long."
                }))
                return

            timestamp = datetime.datetime.utcnow().isoformat() + "Z"

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "chat_message_event",
                    "message": message_stripped,
                    "display_name": self.display_name,
                    "timestamp": timestamp,
                    "sender_channel_name": self.channel_name,
                }
            )

        elif msg_type == "media_state":
            # Reject messages from unidentified connections
            if getattr(self, 'display_name', None) is None:
                await self.close(code=4003)
                return

            audio_enabled = data.get("audio_enabled")
            video_enabled = data.get("video_enabled")
            screen_sharing = data.get("screen_sharing")

            if not isinstance(audio_enabled, bool) or not isinstance(video_enabled, bool) or not isinstance(screen_sharing, bool):
                await self.send(text_data=json.dumps({
                    "type": "media_state_error",
                    "error": "Invalid media state formats."
                }))
                return

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "media_state_event",
                    "audio_enabled": audio_enabled,
                    "video_enabled": video_enabled,
                    "screen_sharing": screen_sharing,
                    "display_name": self.display_name,
                    "sender_channel_name": self.channel_name,
                }
            )

        elif msg_type == "end_meeting":
            # Only the host may end the meeting
            if getattr(self, 'display_name', None) is None:
                await self.close(code=4003)
                return

            room_state = ROOMS.get(self.room_group_name)
            if not room_state or room_state["host_channel_name"] != self.channel_name:
                await self.send(text_data=json.dumps({
                    "type": "meeting_error",
                    "code": "not_host",
                    "message": "Only the meeting host can end the meeting."
                }))
                return

            await self.complete_meeting()

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "meeting_ended_event",
                    "meeting_id": self.meeting_id,
                    "ended_by": self.display_name,
                }
            )

    async def participant_joined_event(self, event):
        await self.send(text_data=json.dumps({
            "type": "participant_joined",
            "meeting_id": event["meeting_id"],
            "display_name": event["display_name"],
            "is_host": event["is_host"],
            "host_display_name": event.get("host_display_name"),
        }))

    async def participant_left_event(self, event):
        await self.send(text_data=json.dumps({
            "type": "participant_left",
            "meeting_id": event["meeting_id"],
            "display_name": event["display_name"],
        }))

    async def signal_event(self, event):
        # Exclude sender from their own signal broadcast
        if self.channel_name != event["sender_channel_name"]:
            await self.send(text_data=json.dumps({
                "type": "signal",
                "signal_type": event["signal_type"],
                "data": event["data"],
            }))

    async def chat_message_event(self, event):
        await self.send(text_data=json.dumps({
            "type": "chat_message",
            "meeting_id": self.meeting_id,
            "display_name": event["display_name"],
            "message": event["message"],
            "timestamp": event["timestamp"],
        }))

    async def media_state_event(self, event):
        # Exclude sender from media state broadcast
        if self.channel_name != event["sender_channel_name"]:
            await self.send(text_data=json.dumps({
                "type": "media_state",
                "meeting_id": self.meeting_id,
                "display_name": event["display_name"],
                "audio_enabled": event["audio_enabled"],
                "video_enabled": event["video_enabled"],
                "screen_sharing": event["screen_sharing"],
            }))

    async def host_changed_event(self, event):
        await self.send(text_data=json.dumps({
            "type": "host_changed",
            "meeting_id": event["meeting_id"],
            "display_name": event["display_name"]
        }))

    async def meeting_ended_event(self, event):
        await self.send(text_data=json.dumps({
            "type": "meeting_ended",
            "meeting_id": event["meeting_id"],
            "ended_by": event["ended_by"]
        }))

    @database_sync_to_async
    def verify_meeting(self, meeting_id):
        return Meeting.objects.filter(meeting_id=meeting_id).exists()

    @database_sync_to_async
    def get_meeting_status(self, meeting_id):
        try:
            meeting = Meeting.objects.get(meeting_id=meeting_id)
            return meeting.status
        except Meeting.DoesNotExist:
            return None

    @database_sync_to_async
    def activate_meeting_if_scheduled(self):
        try:
            meeting = Meeting.objects.get(meeting_id=self.meeting_id)
            if meeting.status == Meeting.Status.SCHEDULED:
                meeting.status = Meeting.Status.ACTIVE
                meeting.save()
        except Meeting.DoesNotExist:
            pass

    @database_sync_to_async
    def complete_meeting(self):
        try:
            meeting = Meeting.objects.get(meeting_id=self.meeting_id)
            meeting.status = Meeting.Status.COMPLETED
            meeting.save()
        except Meeting.DoesNotExist:
            pass
