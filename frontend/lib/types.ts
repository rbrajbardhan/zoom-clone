/**
 * lib/types.ts
 *
 * TypeScript types that mirror the Django REST API's JSON responses exactly.
 *
 * Naming follows the backend's snake_case convention so that API responses
 * can be used directly without a mapping layer.
 *
 * Source of truth: backend/meetings/serializers.py
 */

// ---------------------------------------------------------------------------
// Meeting
// ---------------------------------------------------------------------------

/** The two meeting creation modes supported by the backend. */
export type MeetingType = "instant" | "scheduled";

/** Lifecycle status values managed server-side by the Django backend. */
export type MeetingStatus = "active" | "scheduled" | "completed" | "cancelled";

/**
 * Full Meeting representation returned by the Django API.
 *
 * Matches MeetingSerializer's field list exactly.
 * The internal integer PK is never sent by the API; meeting_id is the
 * public identifier used in all URLs and UI references.
 */
export interface Meeting {
  /** Public meeting identifier, format: "abc-defg-hij" */
  meeting_id: string;

  /** Discriminates between instant and scheduled meetings. */
  meeting_type: MeetingType;

  /** Display title shown on dashboards and meeting cards. */
  title: string;

  /**
   * Optional agenda or notes.
   * null when not provided (typical for instant meetings).
   */
  description: string | null;

  /**
   * Planned start time (ISO 8601 UTC string).
   * null for instant meetings — they have no scheduled time.
   */
  scheduled_at: string | null;

  /** Expected meeting length in minutes (1–1440). */
  duration_minutes: number;

  /** Current lifecycle status. Managed entirely server-side. */
  status: MeetingStatus;

  /** ISO 8601 UTC timestamp of when the meeting record was created. */
  created_at: string;

  /**
   * Full shareable invite URL, e.g. "http://localhost:3000/meeting/abc-defg-hij".
   * Derived at runtime by the backend from meeting_id + FRONTEND_URL setting.
   * Never stored in the database.
   */
  invite_link: string;
}

// ---------------------------------------------------------------------------
// Participant
// ---------------------------------------------------------------------------

/**
 * Participant representation returned by the Django API.
 *
 * Matches ParticipantSerializer's field list exactly.
 * One row represents one join session in one meeting.
 */
export interface Participant {
  /** Internal participant ID — needed for participant-level operations. */
  id: number;

  /** Public meeting identifier this participant belongs to. */
  meeting_id: string;

  /** Display name entered by the participant before joining. */
  display_name: string;

  /** ISO 8601 UTC timestamp of when the participant joined. */
  joined_at: string;

  /**
   * ISO 8601 UTC timestamp of when the participant left.
   * null while the participant is still in the meeting.
   */
  left_at: string | null;
}

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

/**
 * Payload for POST /api/meetings/.
 *
 * Uses a discriminated union so TypeScript enforces the correct fields
 * for each meeting type:
 *   - Instant meetings only require meeting_type.
 *   - Scheduled meetings require meeting_type, title, and scheduled_at.
 *
 * Server-generated fields (meeting_id, status, created_at, invite_link)
 * are intentionally excluded.
 */
export type CreateMeetingRequest =
  | {
      meeting_type: "instant";
      /** Optional override — defaults to "Instant Meeting" on the backend. */
      title?: string;
      /** Optional duration override — defaults to 60 on the backend. */
      duration_minutes?: number;
    }
  | {
      meeting_type: "scheduled";
      /** Required for scheduled meetings. */
      title: string;
      /** Required for scheduled meetings. ISO 8601 UTC string. */
      scheduled_at: string;
      /** Optional agenda text. */
      description?: string;
      /** Optional duration — defaults to 60. */
      duration_minutes?: number;
    };

/**
 * Payload for POST /api/meetings/<meeting_id>/join/.
 *
 * The meeting FK is derived from the URL by the backend.
 * joined_at is set by auto_now_add on the model.
 * Only the display name comes from the client.
 */
export interface JoinMeetingRequest {
  display_name: string;
}

// ---------------------------------------------------------------------------
// API error
// ---------------------------------------------------------------------------

/**
 * Structured error thrown by the API client on non-2xx responses.
 *
 * Enables the UI to distinguish:
 *   - 404 (meeting not found) → show "meeting does not exist" message
 *   - 400 (validation failure) → show field-level errors next to inputs
 *   - 5xx / network failure   → show generic "something went wrong"
 */
export class ApiError extends Error {
  /** HTTP status code from the backend response. */
  readonly status: number;

  /**
   * Human-readable error message.
   * For 404: "Meeting not found."
   * For network failures: "Unable to connect to the backend."
   */
  readonly detail: string;

  /**
   * Field-level validation errors from Django REST Framework.
   * Only present on 400 responses.
   *
   * Example:
   *   { scheduled_at: ["Scheduled meetings require a scheduled date and time."] }
   */
  readonly validationErrors: Record<string, string[]> | null;

  constructor(
    status: number,
    detail: string,
    validationErrors: Record<string, string[]> | null = null
  ) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.validationErrors = validationErrors;
  }
}

// ---------------------------------------------------------------------------
// WebSocket Signaling Messages
// ---------------------------------------------------------------------------

export interface ParticipantJoinedMessage {
  type: "participant_joined";
  meeting_id: string;
  display_name: string;
  is_host?: boolean;
  host_display_name?: string;
}

export interface ParticipantLeftMessage {
  type: "participant_left";
  meeting_id: string;
  display_name: string;
}

export interface IdentifyMessage {
  type: "identify";
  display_name: string;
}

export interface OfferSignalMessage {
  type: "signal";
  signal_type: "offer";
  data: {
    sdp: RTCSessionDescriptionInit;
  };
}

export interface AnswerSignalMessage {
  type: "signal";
  signal_type: "answer";
  data: {
    sdp: RTCSessionDescriptionInit;
  };
}

export interface IceCandidateSignalMessage {
  type: "signal";
  signal_type: "ice-candidate";
  data: {
    candidate: RTCIceCandidateInit;
  };
}

export type SignalMessage =
  | OfferSignalMessage
  | AnswerSignalMessage
  | IceCandidateSignalMessage;

export interface ChatMessage {
  type: "chat_message";
  meeting_id: string;
  display_name: string;
  message: string;
  timestamp: string;
}

export interface ChatErrorMessage {
  type: "chat_error";
  error: string;
}

export interface MediaStateMessage {
  type: "media_state";
  meeting_id?: string;
  display_name?: string;
  audio_enabled: boolean;
  video_enabled: boolean;
  screen_sharing: boolean;
}

export interface MediaStateErrorMessage {
  type: "media_state_error";
  error: string;
}

export interface MeetingEndedMessage {
  type: "meeting_ended";
  meeting_id: string;
  ended_by: string;
}

export interface MeetingErrorMessage {
  type: "meeting_error";
  code: string;
  message: string;
}

export interface HostChangedMessage {
  type: "host_changed";
  meeting_id: string;
  display_name: string;
}

export type WebSocketMessage =
  | ParticipantJoinedMessage
  | ParticipantLeftMessage
  | IdentifyMessage
  | SignalMessage
  | ChatMessage
  | ChatErrorMessage
  | MediaStateMessage
  | MediaStateErrorMessage
  | MeetingEndedMessage
  | MeetingErrorMessage
  | HostChangedMessage;

