/**
 * lib/utils.ts
 *
 * Pure formatting utilities shared across dashboard components.
 * No side effects, no API calls, no React — safe to import anywhere.
 */

import type { MeetingStatus, MeetingType } from "./types";

// ---------------------------------------------------------------------------
// Date / time
// ---------------------------------------------------------------------------

/**
 * Format an ISO 8601 UTC datetime string into a locale-friendly string
 * using the user's local timezone (via Intl).
 *
 * Example: "2026-08-20T14:00:00Z" → "Aug 20 · 2:00 PM"
 * Returns "—" for null inputs (instant meetings have no scheduled_at).
 */
export function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  const datePart = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
  const timePart = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
  return `${datePart} · ${timePart}`;
}

// ---------------------------------------------------------------------------
// Duration
// ---------------------------------------------------------------------------

/**
 * Format duration in minutes to a human-readable string.
 *
 * Examples:
 *   45  → "45 min"
 *   60  → "1h"
 *   90  → "1h 30m"
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

/** Display label for the meeting_type field. */
export function formatMeetingType(type: MeetingType): string {
  return type === "instant" ? "Instant" : "Scheduled";
}

/** Capitalise the first character of a status string. */
export function formatStatus(status: MeetingStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

/**
 * Tailwind class string for a status badge pill.
 * Returns a border + background + text colour combination.
 */
export function getStatusBadgeClass(status: MeetingStatus): string {
  switch (status) {
    case "active":
      return "border-green-200 bg-green-100 text-green-700";
    case "scheduled":
      return "border-blue-200 bg-blue-100 text-blue-700";
    case "completed":
      return "border-gray-200 bg-gray-100 text-gray-600";
    case "cancelled":
      return "border-red-200 bg-red-100 text-red-600";
    default:
      return "border-gray-200 bg-gray-100 text-gray-600";
  }
}
