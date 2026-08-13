import json
from django.test import TransactionTestCase
from channels.testing import WebsocketCommunicator
from config.asgi import application
from .models import Meeting

class MeetingSignalTests(TransactionTestCase):
    def setUp(self):
        # Create a valid meeting in the database
        self.meeting = Meeting.objects.create(
            meeting_id="test-meeting-id",
            meeting_type="instant",
            title="Test Meeting",
            duration_minutes=60,
        )

    async def test_valid_meeting_connect_and_identify(self):
        # Establish connection with valid meeting ID
        communicator = WebsocketCommunicator(
            application, 
            "/ws/meetings/test-meeting-id/"
        )
        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)
        
        # Verify no participant_joined broadcast is sent immediately before identification
        self.assertTrue(await communicator.receive_nothing())

        # Send identification message
        await communicator.send_to(text_data=json.dumps({
            "type": "identify",
            "display_name": "Raj"
        }))

        # Verify it receives its own join event containing the display name
        response = await communicator.receive_from()
        data = json.loads(response)
        self.assertEqual(data["type"], "participant_joined")
        self.assertEqual(data["meeting_id"], "test-meeting-id")
        self.assertEqual(data["display_name"], "Raj")

        await communicator.disconnect()

    async def test_invalid_meeting_rejected(self):
        # Connection with non-existent meeting ID is rejected
        communicator = WebsocketCommunicator(
            application, 
            "/ws/meetings/nonexistent-meeting-id/"
        )
        connected, subprotocol = await communicator.connect()
        self.assertFalse(connected)

    async def test_invalid_format_rejected(self):
        # Connection with invalid format meeting ID is rejected
        communicator = WebsocketCommunicator(
            application, 
            "/ws/meetings/invalid_format_id!!!/"
        )
        connected, subprotocol = await communicator.connect()
        self.assertFalse(connected)

    async def test_identify_validation_rejected_blank(self):
        # Connection accepts valid meeting
        communicator = WebsocketCommunicator(application, "/ws/meetings/test-meeting-id/")
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        # Send blank display name (whitespace only)
        await communicator.send_to(text_data=json.dumps({
            "type": "identify",
            "display_name": "    "
        }))

        # Assert connection is closed with code 4003 (identity rejected)
        response = await communicator.receive_output()
        self.assertEqual(response["type"], "websocket.close")
        self.assertEqual(response["code"], 4003)
        await communicator.disconnect()

    async def test_identify_validation_rejected_overlong(self):
        communicator = WebsocketCommunicator(application, "/ws/meetings/test-meeting-id/")
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        # Send display name over 100 characters
        overlong_name = "A" * 101
        await communicator.send_to(text_data=json.dumps({
            "type": "identify",
            "display_name": overlong_name
        }))

        # Assert connection is closed with code 4003
        response = await communicator.receive_output()
        self.assertEqual(response["type"], "websocket.close")
        self.assertEqual(response["code"], 4003)
        await communicator.disconnect()

    async def test_identify_validation_rejected_nonstring(self):
        communicator = WebsocketCommunicator(application, "/ws/meetings/test-meeting-id/")
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        # Send display name as a number
        await communicator.send_to(text_data=json.dumps({
            "type": "identify",
            "display_name": 12345
        }))

        # Assert connection is closed with code 4003
        response = await communicator.receive_output()
        self.assertEqual(response["type"], "websocket.close")
        self.assertEqual(response["code"], 4003)
        await communicator.disconnect()

    async def test_broadcast_join_leave(self):
        # Socket 1 connects and identifies
        c1 = WebsocketCommunicator(application, "/ws/meetings/test-meeting-id/")
        connected1, _ = await c1.connect()
        self.assertTrue(connected1)
        
        await c1.send_to(text_data=json.dumps({
            "type": "identify",
            "display_name": "Raj"
        }))
        await c1.receive_from() # discard c1 own join

        # Socket 2 connects and identifies
        c2 = WebsocketCommunicator(application, "/ws/meetings/test-meeting-id/")
        connected2, _ = await c2.connect()
        self.assertTrue(connected2)
        
        await c2.send_to(text_data=json.dumps({
            "type": "identify",
            "display_name": "Alex"
        }))
        await c2.receive_from() # discard c2 own join

        # C1 receives C2's join event with C2's display name
        response = await c1.receive_from()
        data = json.loads(response)
        self.assertEqual(data["type"], "participant_joined")
        self.assertEqual(data["meeting_id"], "test-meeting-id")
        self.assertEqual(data["display_name"], "Alex")

        # C2 disconnects
        await c2.disconnect()

        # C1 receives C2's leave event with C2's display name
        response = await c1.receive_from()
        data = json.loads(response)
        self.assertEqual(data["type"], "participant_left")
        self.assertEqual(data["meeting_id"], "test-meeting-id")
        self.assertEqual(data["display_name"], "Alex")

        await c1.disconnect()

    async def test_signal_broadcast_excludes_sender(self):
        # Socket 1 connects and identifies
        c1 = WebsocketCommunicator(application, "/ws/meetings/test-meeting-id/")
        connected1, _ = await c1.connect()
        self.assertTrue(connected1)
        await c1.send_to(text_data=json.dumps({"type": "identify", "display_name": "Raj"}))
        await c1.receive_from() # discard join

        # Socket 2 connects and identifies
        c2 = WebsocketCommunicator(application, "/ws/meetings/test-meeting-id/")
        connected2, _ = await c2.connect()
        self.assertTrue(connected2)
        await c2.send_to(text_data=json.dumps({"type": "identify", "display_name": "Alex"}))
        await c2.receive_from() # discard join
        await c1.receive_from() # discard C2's join in C1

        # C1 sends a signal
        signal_msg = {
            "type": "signal",
            "signal_type": "offer",
            "data": {"sdp": "example-sdp"}
        }
        await c1.send_to(text_data=json.dumps(signal_msg))

        # C2 should receive the signal
        response = await c2.receive_from()
        data = json.loads(response)
        self.assertEqual(data["type"], "signal")
        self.assertEqual(data["signal_type"], "offer")
        self.assertEqual(data["data"]["sdp"], "example-sdp")

        # C1 (sender) should NOT receive its own signal back (timeout / receive_nothing should return True)
        self.assertTrue(await c1.receive_nothing())

        await c1.disconnect()
        await c2.disconnect()

    async def test_chat_message_broadcast_valid(self):
        c1 = WebsocketCommunicator(application, "/ws/meetings/test-meeting-id/")
        connected, _ = await c1.connect()
        self.assertTrue(connected)
        await c1.send_to(text_data=json.dumps({"type": "identify", "display_name": "Raj"}))
        await c1.receive_from()

        # Send valid chat message
        await c1.send_to(text_data=json.dumps({
            "type": "chat_message",
            "message": "Hello everyone!"
        }))

        response = await c1.receive_from()
        data = json.loads(response)
        self.assertEqual(data["type"], "chat_message")
        self.assertEqual(data["meeting_id"], "test-meeting-id")
        self.assertEqual(data["display_name"], "Raj")
        self.assertEqual(data["message"], "Hello everyone!")
        self.assertIn("timestamp", data)
        await c1.disconnect()

    async def test_chat_message_name_spoof_prevention(self):
        c1 = WebsocketCommunicator(application, "/ws/meetings/test-meeting-id/")
        connected, _ = await c1.connect()
        self.assertTrue(connected)
        await c1.send_to(text_data=json.dumps({"type": "identify", "display_name": "Raj"}))
        await c1.receive_from()

        # Try to spoof name in payload (server must ignore it and use socket state)
        await c1.send_to(text_data=json.dumps({
            "type": "chat_message",
            "display_name": "Spoofed Name",
            "message": "Test"
        }))

        response = await c1.receive_from()
        data = json.loads(response)
        self.assertEqual(data["display_name"], "Raj")
        await c1.disconnect()

    async def test_chat_message_validation_rejected_blank(self):
        c1 = WebsocketCommunicator(application, "/ws/meetings/test-meeting-id/")
        connected, _ = await c1.connect()
        self.assertTrue(connected)
        await c1.send_to(text_data=json.dumps({"type": "identify", "display_name": "Raj"}))
        await c1.receive_from()

        # Send blank message
        await c1.send_to(text_data=json.dumps({
            "type": "chat_message",
            "message": "    "
        }))

        response = await c1.receive_from()
        data = json.loads(response)
        self.assertEqual(data["type"], "chat_error")
        self.assertEqual(data["error"], "Message cannot be empty.")
        await c1.disconnect()

    async def test_chat_message_validation_rejected_overlong(self):
        c1 = WebsocketCommunicator(application, "/ws/meetings/test-meeting-id/")
        connected, _ = await c1.connect()
        self.assertTrue(connected)
        await c1.send_to(text_data=json.dumps({"type": "identify", "display_name": "Raj"}))
        await c1.receive_from()

        # Send overlong message (1001 characters)
        overlong_message = "A" * 1001
        await c1.send_to(text_data=json.dumps({
            "type": "chat_message",
            "message": overlong_message
        }))

        response = await c1.receive_from()
        data = json.loads(response)
        self.assertEqual(data["type"], "chat_error")
        self.assertEqual(data["error"], "Message is too long.")
        await c1.disconnect()

    async def test_chat_message_rejected_before_identify(self):
        c1 = WebsocketCommunicator(application, "/ws/meetings/test-meeting-id/")
        connected, _ = await c1.connect()
        self.assertTrue(connected)

        # Send chat message before identify
        await c1.send_to(text_data=json.dumps({
            "type": "chat_message",
            "message": "Test"
        }))

        # Assert connection is closed with code 4003 (identify rejected)
        response = await c1.receive_output()
        self.assertEqual(response["type"], "websocket.close")
        self.assertEqual(response["code"], 4003)
        await c1.disconnect()

    async def test_chat_message_received_by_both_participants(self):
        c1 = WebsocketCommunicator(application, "/ws/meetings/test-meeting-id/")
        connected1, _ = await c1.connect()
        self.assertTrue(connected1)
        await c1.send_to(text_data=json.dumps({"type": "identify", "display_name": "Raj"}))
        await c1.receive_from()

        c2 = WebsocketCommunicator(application, "/ws/meetings/test-meeting-id/")
        connected2, _ = await c2.connect()
        self.assertTrue(connected2)
        await c2.send_to(text_data=json.dumps({"type": "identify", "display_name": "Alex"}))
        await c2.receive_from()
        await c1.receive_from() # discard join

        # C1 sends chat message
        await c1.send_to(text_data=json.dumps({
            "type": "chat_message",
            "message": "Sync check"
        }))

        # Both receive it
        r1 = await c1.receive_from()
        d1 = json.loads(r1)
        self.assertEqual(d1["message"], "Sync check")
        self.assertEqual(d1["display_name"], "Raj")

        r2 = await c2.receive_from()
        d2 = json.loads(r2)
        self.assertEqual(d2["message"], "Sync check")
        self.assertEqual(d2["display_name"], "Raj")

        await c1.disconnect()
        await c2.disconnect()

    async def test_media_state_valid_broadcast(self):
        c1 = WebsocketCommunicator(application, "/ws/meetings/test-meeting-id/")
        connected1, _ = await c1.connect()
        self.assertTrue(connected1)
        await c1.send_to(text_data=json.dumps({"type": "identify", "display_name": "Raj"}))
        await c1.receive_from()

        c2 = WebsocketCommunicator(application, "/ws/meetings/test-meeting-id/")
        connected2, _ = await c2.connect()
        self.assertTrue(connected2)
        await c2.send_to(text_data=json.dumps({"type": "identify", "display_name": "Alex"}))
        await c2.receive_from()
        await c1.receive_from() # discard join

        # C1 sends valid media state
        await c1.send_to(text_data=json.dumps({
            "type": "media_state",
            "audio_enabled": False,
            "video_enabled": True,
            "screen_sharing": True
        }))

        # C2 should receive c1's media state
        response = await c2.receive_from()
        data = json.loads(response)
        self.assertEqual(data["type"], "media_state")
        self.assertEqual(data["meeting_id"], "test-meeting-id")
        self.assertEqual(data["display_name"], "Raj")
        self.assertEqual(data["audio_enabled"], False)
        self.assertEqual(data["video_enabled"], True)
        self.assertEqual(data["screen_sharing"], True)

        await c1.disconnect()
        await c2.disconnect()

    async def test_media_state_rejected_before_identify(self):
        c1 = WebsocketCommunicator(application, "/ws/meetings/test-meeting-id/")
        connected, _ = await c1.connect()
        self.assertTrue(connected)

        # Send media state before identify
        await c1.send_to(text_data=json.dumps({
            "type": "media_state",
            "audio_enabled": True,
            "video_enabled": True,
            "screen_sharing": False
        }))

        # Assert connection is closed with code 4003 (identify rejected)
        response = await c1.receive_output()
        self.assertEqual(response["type"], "websocket.close")
        self.assertEqual(response["code"], 4003)
        await c1.disconnect()

    async def test_media_state_rejected_invalid_types(self):
        c1 = WebsocketCommunicator(application, "/ws/meetings/test-meeting-id/")
        connected, _ = await c1.connect()
        self.assertTrue(connected)
        await c1.send_to(text_data=json.dumps({"type": "identify", "display_name": "Raj"}))
        await c1.receive_from()

        # Send non-boolean audio_enabled
        await c1.send_to(text_data=json.dumps({
            "type": "media_state",
            "audio_enabled": "yes",
            "video_enabled": True,
            "screen_sharing": False
        }))

        response = await c1.receive_from()
        data = json.loads(response)
        self.assertEqual(data["type"], "media_state_error")
        self.assertEqual(data["error"], "Invalid media state formats.")
        await c1.disconnect()

    async def test_media_state_excludes_sender(self):
        c1 = WebsocketCommunicator(application, "/ws/meetings/test-meeting-id/")
        connected, _ = await c1.connect()
        self.assertTrue(connected)
        await c1.send_to(text_data=json.dumps({"type": "identify", "display_name": "Raj"}))
        await c1.receive_from()

        # C1 sends media state
        await c1.send_to(text_data=json.dumps({
            "type": "media_state",
            "audio_enabled": False,
            "video_enabled": False,
            "screen_sharing": False
        }))

        # Sender should NOT receive its own media state back
        self.assertTrue(await c1.receive_nothing())
        await c1.disconnect()

    async def test_media_state_display_name_anti_spoofing(self):
        c1 = WebsocketCommunicator(application, "/ws/meetings/test-meeting-id/")
        connected1, _ = await c1.connect()
        self.assertTrue(connected1)
        await c1.send_to(text_data=json.dumps({"type": "identify", "display_name": "Raj"}))
        await c1.receive_from()

        c2 = WebsocketCommunicator(application, "/ws/meetings/test-meeting-id/")
        connected2, _ = await c2.connect()
        self.assertTrue(connected2)
        await c2.send_to(text_data=json.dumps({"type": "identify", "display_name": "Alex"}))
        await c2.receive_from()
        await c1.receive_from() # discard join

        # Try to spoof name in media_state body
        await c1.send_to(text_data=json.dumps({
            "type": "media_state",
            "display_name": "Spoofed User",
            "audio_enabled": True,
            "video_enabled": True,
            "screen_sharing": False
        }))

        # C2 should receive message from "Raj" (server identity), not the spoofed name
        # C2 should receive message from "Raj" (server identity), not the spoofed name
        response = await c2.receive_from()
        data = json.loads(response)
        self.assertEqual(data["display_name"], "Raj")

        await c1.disconnect()
        await c2.disconnect()

    async def test_first_identified_becomes_host(self):
        c1 = WebsocketCommunicator(application, "/ws/meetings/test-meeting-id/")
        connected, _ = await c1.connect()
        self.assertTrue(connected)
        await c1.send_to(text_data=json.dumps({"type": "identify", "display_name": "Raj"}))
        response = await c1.receive_from()
        data = json.loads(response)
        self.assertEqual(data["type"], "participant_joined")
        self.assertEqual(data["display_name"], "Raj")
        self.assertEqual(data["is_host"], True)
        await c1.disconnect()

    async def test_second_identified_is_not_host(self):
        c1 = WebsocketCommunicator(application, "/ws/meetings/test-meeting-id/")
        connected1, _ = await c1.connect()
        self.assertTrue(connected1)
        await c1.send_to(text_data=json.dumps({"type": "identify", "display_name": "Raj"}))
        await c1.receive_from()

        c2 = WebsocketCommunicator(application, "/ws/meetings/test-meeting-id/")
        connected2, _ = await c2.connect()
        self.assertTrue(connected2)
        await c2.send_to(text_data=json.dumps({"type": "identify", "display_name": "Alex"}))
        
        r2 = await c2.receive_from()
        d2 = json.loads(r2)
        self.assertEqual(d2["type"], "participant_joined")
        self.assertEqual(d2["display_name"], "Alex")
        self.assertEqual(d2["is_host"], False)

        await c1.disconnect()
        await c2.disconnect()

    async def test_host_can_end_meeting_and_completes_db(self):
        c1 = WebsocketCommunicator(application, "/ws/meetings/test-meeting-id/")
        connected, _ = await c1.connect()
        self.assertTrue(connected)
        await c1.send_to(text_data=json.dumps({"type": "identify", "display_name": "Raj"}))
        await c1.receive_from()

        # Send end meeting
        await c1.send_to(text_data=json.dumps({"type": "end_meeting"}))
        response = await c1.receive_from()
        data = json.loads(response)
        self.assertEqual(data["type"], "meeting_ended")
        self.assertEqual(data["ended_by"], "Raj")

        # Verify database record safely in async context
        from .models import Meeting
        from asgiref.sync import sync_to_async
        m = await sync_to_async(Meeting.objects.get)(meeting_id="test-meeting-id")
        self.assertEqual(m.status, "completed")
        await c1.disconnect()

    async def test_non_host_cannot_end_meeting(self):
        c1 = WebsocketCommunicator(application, "/ws/meetings/test-meeting-id/")
        connected1, _ = await c1.connect()
        self.assertTrue(connected1)
        await c1.send_to(text_data=json.dumps({"type": "identify", "display_name": "Raj"}))
        await c1.receive_from()

        c2 = WebsocketCommunicator(application, "/ws/meetings/test-meeting-id/")
        connected2, _ = await c2.connect()
        self.assertTrue(connected2)
        await c2.send_to(text_data=json.dumps({"type": "identify", "display_name": "Alex"}))
        await c2.receive_from() # discard join

        # Alex (non-host) tries to end meeting
        await c2.send_to(text_data=json.dumps({"type": "end_meeting"}))
        response = await c2.receive_from()
        data = json.loads(response)
        self.assertEqual(data["type"], "meeting_error")
        self.assertEqual(data["code"], "not_host")

        # Verify database remains active safely in async context
        from .models import Meeting
        from asgiref.sync import sync_to_async
        m = await sync_to_async(Meeting.objects.get)(meeting_id="test-meeting-id")
        self.assertEqual(m.status, "active")

        await c1.disconnect()
        await c2.disconnect()

    def test_join_completed_meeting_rejected_via_rest(self):
        from .models import Meeting
        m = Meeting.objects.create(
            meeting_type="instant",
            status="completed"
        )
        url = f"/api/meetings/{m.meeting_id}/join/"
        response = self.client.post(url, data={"display_name": "Raj"})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "This meeting has already ended.")

    def test_join_cancelled_meeting_rejected_via_rest(self):
        from .models import Meeting
        m = Meeting.objects.create(
            meeting_type="scheduled",
            status="cancelled"
        )
        url = f"/api/meetings/{m.meeting_id}/join/"
        response = self.client.post(url, data={"display_name": "Raj"})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "This meeting has already ended.")

    async def test_host_leave_triggers_handoff(self):
        c1 = WebsocketCommunicator(application, "/ws/meetings/test-meeting-id/")
        connected1, _ = await c1.connect()
        self.assertTrue(connected1)
        await c1.send_to(text_data=json.dumps({"type": "identify", "display_name": "Raj"}))
        await c1.receive_from()

        c2 = WebsocketCommunicator(application, "/ws/meetings/test-meeting-id/")
        connected2, _ = await c2.connect()
        self.assertTrue(connected2)
        await c2.send_to(text_data=json.dumps({"type": "identify", "display_name": "Alex"}))
        
        # We need to discard c2's own join message in c2's queue
        await c2.receive_from()
        
        # Discard c2's join message in c1's queue
        await c1.receive_from()

        # Host c1 disconnects
        await c1.disconnect()

        # c2 should receive host_changed event declaring Alex as host
        response = await c2.receive_from()
        data = json.loads(response)
        # Discard left event if it comes first
        if data["type"] == "participant_left":
            response = await c2.receive_from()
            data = json.loads(response)
        
        self.assertEqual(data["type"], "host_changed")
        self.assertEqual(data["display_name"], "Alex")
        
        await c2.disconnect()
