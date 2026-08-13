/**
 * lib/api.ts
 *
 * Centralized API client for the Zoom Clone frontend.
 *
 * All communication with the Django REST backend goes through this module.
 * No other file should construct fetch() calls directly.
 *
 * Base URL
 * --------
 * Read from the NEXT_PUBLIC_API_URL environment variable.
 * Set in frontend/.env.local for development:
 *   NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api
 *
 * The URL is never hardcoded here. Changing the env var is the only thing
 * needed to point the app at a different backend (e.g. staging or production).
 *
 * API endpoints implemented
 * -------------------------
 *   getMeetings()                   GET  /meetings/
 *   createMeeting(data)             POST /meetings/
 *   getUpcomingMeetings()           GET  /meetings/upcoming/
 *   getRecentMeetings()             GET  /meetings/recent/
 *   getMeeting(meetingId)           GET  /meetings/<meeting_id>/
 *   joinMeeting(meetingId, data)    POST /meetings/<meeting_id>/join/
 *
 * Error handling
 * --------------
 *   All functions throw ApiError on non-2xx responses or network failure.
 *   Callers can inspect err.status, err.detail, and err.validationErrors.
 */

import { ApiError, type CreateMeetingRequest, type JoinMeetingRequest, type Meeting, type Participant } from "./types";

// ---------------------------------------------------------------------------
// URL builder
// ---------------------------------------------------------------------------

/**
 * Construct an absolute API URL from a relative path.
 *
 * Strips a trailing slash from the base URL and a leading slash from the
 * path segment, then joins them with exactly one slash — preventing both
 * double-slash (/api//meetings/) and missing-slash (/apimeetings/) bugs.
 *
 * Examples:
 *   buildUrl("meetings/")           → "http://127.0.0.1:8000/api/meetings/"
 *   buildUrl("meetings/abc/join/")  → "http://127.0.0.1:8000/api/meetings/abc/join/"
 */
function buildUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
  const normalizedPath = path.replace(/^\//, "");
  return `${base}/${normalizedPath}`;
}

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------

/**
 * Send an HTTP request to the Django backend and return parsed JSON.
 *
 * Handles:
 *   - JSON serialization of request bodies.
 *   - Parsing Django REST Framework error responses (detail / field errors).
 *   - Network failures (Django not running, DNS failure, etc.).
 *
 * Throws ApiError for:
 *   - 400  Validation errors — err.validationErrors contains field details.
 *   - 404  Resource not found — err.detail is "Meeting not found."
 *   - Any other non-2xx response — err.status and err.detail reflect the response.
 *   - Network failure — err.status is 0, err.detail is "Unable to connect to the backend."
 */
async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = buildUrl(path);

  const defaultHeaders: HeadersInit = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  let response: Response;

  try {
    response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });
  } catch {
    // fetch() itself threw — the server is unreachable (Django not running,
    // wrong port, DNS failure, etc.).
    throw new ApiError(
      0,
      "Unable to connect to the backend. Is Django running?"
    );
  }

  // Parse the response body as JSON regardless of status code so we can
  // extract Django's structured error messages.
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    // Response body is not JSON (e.g. empty 204 or an HTML error page).
    body = null;
  }

  if (!response.ok) {
    // Attempt to extract DRF's structured error format.
    //
    // DRF returns one of:
    //   { "detail": "Meeting not found." }             ← 404
    //   { "field": ["error message"] }                 ← 400 validation
    //   { "non_field_errors": ["..."] }                ← 400 cross-field
    const errorBody = body as Record<string, unknown> | null;

    // Extract a human-readable top-level message.
    const detail =
      typeof errorBody?.detail === "string"
        ? errorBody.detail
        : `Request failed with status ${response.status}.`;

    // Extract field-level validation errors (present only on 400).
    let validationErrors: Record<string, string[]> | null = null;
    if (response.status === 400 && errorBody) {
      const fieldErrors: Record<string, string[]> = {};
      for (const [key, value] of Object.entries(errorBody)) {
        if (key !== "detail" && Array.isArray(value)) {
          fieldErrors[key] = value as string[];
        }
      }
      if (Object.keys(fieldErrors).length > 0) {
        validationErrors = fieldErrors;
      }
    }

    throw new ApiError(response.status, detail, validationErrors);
  }

  return body as T;
}

// ---------------------------------------------------------------------------
// Public API functions
// ---------------------------------------------------------------------------

/**
 * GET /meetings/
 *
 * Fetch all meetings, ordered by newest created_at first.
 * Used to populate a general meeting list.
 */
export async function getMeetings(): Promise<Meeting[]> {
  return apiFetch<Meeting[]>("meetings/");
}

/**
 * POST /meetings/
 *
 * Create a new meeting (instant or scheduled).
 *
 * The backend auto-generates meeting_id, sets status based on meeting_type,
 * and derives invite_link — none of these come from the client.
 *
 * @param data - CreateMeetingRequest (discriminated union enforced by TS)
 */
export async function createMeeting(data: CreateMeetingRequest): Promise<Meeting> {
  return apiFetch<Meeting>("meetings/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * GET /meetings/upcoming/
 *
 * Fetch scheduled meetings whose scheduled_at is in the future.
 * Ordered nearest-first by the backend.
 * Instant meetings are never included.
 */
export async function getUpcomingMeetings(): Promise<Meeting[]> {
  return apiFetch<Meeting[]>("meetings/upcoming/");
}

/**
 * GET /meetings/recent/
 *
 * Fetch recent meetings (completed, active instant, or past scheduled).
 * Cancelled meetings are excluded by the backend.
 * Ordered by most recent activity first.
 */
export async function getRecentMeetings(): Promise<Meeting[]> {
  return apiFetch<Meeting[]>("meetings/recent/");
}

/**
 * GET /meetings/<meeting_id>/
 *
 * Fetch a single meeting by its public meeting_id.
 *
 * Throws ApiError with status 404 if the meeting does not exist.
 * Used for meeting detail pages and join-meeting validation.
 *
 * @param meetingId - The public meeting ID (e.g. "abc-defg-hij")
 */
export async function getMeeting(meetingId: string): Promise<Meeting> {
  return apiFetch<Meeting>(`meetings/${meetingId}/`);
}

/**
 * POST /meetings/<meeting_id>/join/
 *
 * Create a Participant record for the given meeting.
 * The meeting FK is derived server-side from the URL.
 * joined_at is set automatically by the backend.
 *
 * Throws ApiError with status 404 if the meeting does not exist.
 * Throws ApiError with status 400 if display_name is invalid.
 *
 * @param meetingId - The public meeting ID
 * @param data      - { display_name: string }
 */
export async function joinMeeting(
  meetingId: string,
  data: JoinMeetingRequest
): Promise<Participant> {
  return apiFetch<Participant>(`meetings/${meetingId}/join/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
