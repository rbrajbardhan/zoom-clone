"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createMeeting, joinMeeting } from "@/lib/api";
import { Meeting, Participant, ApiError } from "@/lib/types";
import { formatDateTime, formatDuration } from "@/lib/utils";

export default function QuickActions() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdMeeting, setCreatedMeeting] = useState<Meeting | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Join Meeting states
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [joinMeetingId, setJoinMeetingId] = useState("");
  const [joinDisplayName, setJoinDisplayName] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinFieldErrors, setJoinFieldErrors] = useState<{
    meetingId?: string;
    displayName?: string;
  }>({});
  const [joinedMeeting, setJoinedMeeting] = useState<Participant | null>(null);

  // Schedule Meeting states
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [scheduleTitle, setScheduleTitle] = useState("");
  const [scheduleDescription, setScheduleDescription] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleDuration, setScheduleDuration] = useState("60");
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleFieldErrors, setScheduleFieldErrors] = useState<{
    title?: string;
    date?: string;
    time?: string;
    duration?: string;
  }>({});
  // Escape key handler to close active modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsJoinOpen(false);
        setIsScheduleOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleNewMeeting = async () => {
    try {
      setIsCreating(true);
      setError(null);
      setCreatedMeeting(null);
      const meeting = await createMeeting({ meeting_type: "instant" });
      setCreatedMeeting(meeting);
    } catch (err: unknown) {
      const apiError = err as { detail?: string };
      setError(apiError.detail || "Unable to create the meeting. Please make sure the backend is running and try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);
    setJoinFieldErrors({});

    const trimmedMeetingId = joinMeetingId.trim();
    const trimmedDisplayName = joinDisplayName.trim();

    let hasError = false;
    const newFieldErrors: typeof joinFieldErrors = {};

    if (!trimmedMeetingId) {
      newFieldErrors.meetingId = "Meeting ID is required.";
      hasError = true;
    }

    if (!trimmedDisplayName) {
      newFieldErrors.displayName = "Display name is required.";
      hasError = true;
    } else if (trimmedDisplayName.length < 2) {
      newFieldErrors.displayName = "Display name must contain at least 2 characters.";
      hasError = true;
    }

    if (hasError) {
      setJoinFieldErrors(newFieldErrors);
      return;
    }

    try {
      setIsJoining(true);
      const participant = await joinMeeting(trimmedMeetingId, {
        display_name: trimmedDisplayName,
      });
      if (typeof window !== "undefined") {
        sessionStorage.setItem(
          `meeting-display-name:${participant.meeting_id}`,
          participant.display_name
        );
      }
      setJoinedMeeting(participant);
      setIsJoinOpen(false);
      setJoinMeetingId("");
      setJoinDisplayName("");
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      if (apiErr.status !== undefined) {
        if (apiErr.status === 0) {
          setJoinError("Unable to connect to the backend.");
        } else if (apiErr.status === 404) {
          setJoinError("Meeting not found.");
        } else if (apiErr.status === 400) {
          if (apiErr.validationErrors) {
            const drfErrors: typeof joinFieldErrors = {};
            if (apiErr.validationErrors.display_name) {
              drfErrors.displayName = apiErr.validationErrors.display_name.join(" ");
            }
            if (apiErr.validationErrors.meeting_id) {
              drfErrors.meetingId = apiErr.validationErrors.meeting_id.join(" ");
            }
            setJoinFieldErrors(drfErrors);
            setJoinError(apiErr.detail || "Please correct the errors below.");
          } else {
            setJoinError(apiErr.detail);
          }
        } else if (apiErr.status >= 500) {
          setJoinError("Something went wrong on the server. Please try again.");
        } else {
          setJoinError(apiErr.detail || "An unexpected error occurred.");
        }
      } else {
        setJoinError("Unable to connect to the backend.");
      }
    } finally {
      setIsJoining(false);
    }
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setScheduleError(null);
    setScheduleFieldErrors({});

    const trimmedTitle = scheduleTitle.trim();
    const trimmedDescription = scheduleDescription.trim();
    const date = scheduleDate;
    const time = scheduleTime;
    const duration = Number(scheduleDuration);

    let hasError = false;
    const newFieldErrors: typeof scheduleFieldErrors = {};

    if (!trimmedTitle) {
      newFieldErrors.title = "Title is required.";
      hasError = true;
    }

    if (!date) {
      newFieldErrors.date = "Date is required.";
      hasError = true;
    }

    if (!time) {
      newFieldErrors.time = "Time is required.";
      hasError = true;
    }

    if (date && time) {
      const scheduledDateTime = new Date(`${date}T${time}`);
      if (isNaN(scheduledDateTime.getTime())) {
        newFieldErrors.time = "Invalid date or time format.";
        hasError = true;
      } else if (scheduledDateTime <= new Date()) {
        newFieldErrors.time = "Scheduled time must be in the future.";
        hasError = true;
      }
    }

    if (isNaN(duration) || duration < 1 || duration > 1440 || !Number.isInteger(duration)) {
      newFieldErrors.duration = "Duration must be an integer between 1 and 1440 minutes.";
      hasError = true;
    }

    if (hasError) {
      setScheduleFieldErrors(newFieldErrors);
      return;
    }

    const scheduledAt = new Date(`${date}T${time}`).toISOString();

    try {
      setIsScheduling(true);
      const meeting = await createMeeting({
        meeting_type: "scheduled",
        title: trimmedTitle,
        description: trimmedDescription || undefined,
        scheduled_at: scheduledAt,
        duration_minutes: duration,
      });
      setCreatedMeeting(meeting);
      setIsScheduleOpen(false);
      
      setScheduleTitle("");
      setScheduleDescription("");
      setScheduleDate("");
      setScheduleTime("");
      setScheduleDuration("60");

      window.dispatchEvent(new Event("meeting-scheduled"));
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      if (apiErr.status !== undefined) {
        if (apiErr.status === 0) {
          setScheduleError("Unable to connect to the backend.");
        } else if (apiErr.status === 400) {
          if (apiErr.validationErrors) {
            const drfErrors: typeof scheduleFieldErrors = {};
            if (apiErr.validationErrors.title) {
              drfErrors.title = apiErr.validationErrors.title.join(" ");
            }
            if (apiErr.validationErrors.scheduled_at) {
              drfErrors.date = apiErr.validationErrors.scheduled_at.join(" ");
            }
            if (apiErr.validationErrors.duration_minutes) {
              drfErrors.duration = apiErr.validationErrors.duration_minutes.join(" ");
            }
            setScheduleFieldErrors(drfErrors);
            setScheduleError(apiErr.detail || "Please correct the errors below.");
          } else {
            setScheduleError(apiErr.detail);
          }
        } else if (apiErr.status >= 500) {
          setScheduleError("Something went wrong on the server. Please try again.");
        } else {
          setScheduleError(apiErr.detail || "An unexpected error occurred.");
        }
      } else {
        setScheduleError("Unable to connect to the backend.");
      }
    } finally {
      setIsScheduling(false);
    }
  };

  const handleCopyLink = async () => {
    if (!createdMeeting) return;
    try {
      await navigator.clipboard.writeText(createdMeeting.invite_link);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Error state */}
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 border border-red-200 flex items-start gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 flex-shrink-0 mt-0.5">
            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
          </svg>
          <p>{error}</p>
        </div>
      )}

      {/* Success State for New Meeting / Scheduled Meeting */}
      {createdMeeting && (
        <div className="rounded-xl bg-green-50 border border-green-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4 text-green-800">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
            </svg>
            <h3 className="text-lg font-bold">
              {createdMeeting.meeting_type === "scheduled" ? "Meeting scheduled successfully" : "Meeting created successfully"}
            </h3>
          </div>
          
          <div className="bg-white rounded-lg p-4 mb-4 border border-green-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-3">
              {createdMeeting.meeting_type === "scheduled" && (
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Title</p>
                  <p className="text-base font-semibold text-gray-900">{createdMeeting.title}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Meeting ID</p>
                <p className="font-mono text-lg font-semibold tracking-wider text-gray-900">{createdMeeting.meeting_id}</p>
              </div>
              {createdMeeting.meeting_type === "scheduled" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Scheduled At</p>
                    <p className="text-sm text-gray-900 font-medium">{formatDateTime(createdMeeting.scheduled_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Duration</p>
                    <p className="text-sm text-gray-900 font-medium">{formatDuration(createdMeeting.duration_minutes)}</p>
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Invite Link</p>
                <p className="font-mono text-sm text-gray-900 break-all select-all selection:bg-green-100">
                  {createdMeeting.invite_link}
                </p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleCopyLink}
                className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                </svg>
                {copySuccess ? "Copied!" : "Copy Link"}
              </button>
              <button
                onClick={() => router.push(`/meeting/${createdMeeting.meeting_id}`)}
                className="flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand/90 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
              >
                Open Meeting
              </button>
            </div>
          </div>
          <button 
            onClick={() => setCreatedMeeting(null)}
            className="text-sm font-medium text-green-700 hover:text-green-900 underline underline-offset-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Success State for Join Meeting */}
      {joinedMeeting && (
        <div className="rounded-xl bg-green-50 border border-green-200 p-6 shadow-sm animate-fade-in">
          <div className="flex items-center gap-3 mb-4 text-green-800">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
            </svg>
            <h3 className="text-lg font-bold">You joined the meeting successfully</h3>
          </div>
          
          <div className="bg-white rounded-lg p-4 mb-4 border border-green-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-sm text-gray-500 font-medium">Meeting ID</p>
              <p className="font-mono text-lg font-semibold tracking-wider text-gray-900">{joinedMeeting.meeting_id}</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => router.push(`/meeting/${joinedMeeting.meeting_id}`)}
                className="flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand/90 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
              >
                Enter Meeting
              </button>
            </div>
          </div>
          <button 
            onClick={() => setJoinedMeeting(null)}
            className="text-sm font-medium text-green-700 hover:text-green-900 underline underline-offset-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Quick Action Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* New Meeting */}
        <button
          onClick={handleNewMeeting}
          disabled={isCreating}
          className="group relative flex flex-col items-center justify-center gap-4 rounded-2xl bg-brand p-8 text-white shadow-md transition-all hover:bg-brand/90 hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <div className="rounded-2xl bg-white/20 p-4 transition-transform group-hover:scale-105 group-disabled:scale-100">
            {isCreating ? (
              <svg className="w-8 h-8 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
                <path d="M4 4h11a2 2 0 0 1 2 2v3.5l3-2v9l-3-2V18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
              </svg>
            )}
          </div>
          <div className="text-center">
            <h3 className="text-lg font-bold">New Meeting</h3>
            <p className="mt-1 text-sm text-brand-light/90">Start an instant meeting</p>
          </div>
        </button>

        {/* Join Meeting */}
        <button
          onClick={() => {
            setJoinError(null);
            setJoinFieldErrors({});
            setIsJoinOpen(true);
          }}
          className="group relative flex flex-col items-center justify-center gap-4 rounded-2xl bg-white p-8 border border-border text-gray-900 shadow-sm transition-all hover:border-brand/30 hover:shadow-md"
        >
          <div className="rounded-2xl bg-surface p-4 text-brand transition-transform group-hover:scale-105">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
              <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm4.28 10.28a.75.75 0 0 0 0-1.06l-3-3a.75.75 0 1 0-1.06 1.06l1.72 1.72H8.25a.75.75 0 0 0 0 1.5h5.69l-1.72 1.72a.75.75 0 1 0 1.06 1.06l3-3Z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-bold text-gray-900">Join Meeting</h3>
            <p className="mt-1 text-sm text-gray-600">Join with a Meeting ID</p>
          </div>
        </button>

        {/* Schedule Meeting */}
        <button
          onClick={() => {
            setScheduleError(null);
            setScheduleFieldErrors({});
            setIsScheduleOpen(true);
          }}
          className="group relative flex flex-col items-center justify-center gap-4 rounded-2xl bg-white p-8 border border-border text-gray-900 shadow-sm transition-all hover:border-brand/30 hover:shadow-md"
        >
          <div className="rounded-2xl bg-surface p-4 text-brand transition-transform group-hover:scale-105">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
              <path d="M12.75 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM7.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM8.25 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM9.75 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM10.5 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM12.75 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM14.25 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" />
              <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-bold text-gray-900">Schedule Meeting</h3>
            <p className="mt-1 text-sm text-gray-600">Plan a meeting for later</p>
          </div>
        </button>
      </div>

      {/* Join Meeting Modal */}
      {isJoinOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity">
          <div 
            className="w-full max-w-md bg-white rounded-2xl border border-border p-6 shadow-xl transition-all"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 id="modal-title" className="text-xl font-bold text-gray-900">
                Join a Meeting
              </h2>
              <button
                type="button"
                onClick={() => {
                  if (!isJoining) {
                    setIsJoinOpen(false);
                    setJoinError(null);
                    setJoinFieldErrors({});
                  }
                }}
                disabled={isJoining}
                className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {joinError && (
              <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700 border border-red-200 flex items-start gap-2.5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 flex-shrink-0 mt-0.5">
                  <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
                </svg>
                <p>{joinError}</p>
              </div>
            )}

            <form onSubmit={handleJoinSubmit} className="space-y-4">
              <div>
                <label htmlFor="meeting-id" className="block text-sm font-semibold text-gray-700 mb-1">
                  Meeting ID
                </label>
                <input
                  id="meeting-id"
                  type="text"
                  value={joinMeetingId}
                  onChange={(e) => setJoinMeetingId(e.target.value)}
                  placeholder="Enter meeting ID (e.g. abc-defg-hij)"
                  disabled={isJoining}
                  className={`w-full px-3.5 py-2 border rounded-xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors text-gray-900 ${
                    joinFieldErrors.meetingId ? "border-red-300 focus:ring-red-500 focus:border-red-500" : "border-gray-300"
                  }`}
                />
                {joinFieldErrors.meetingId && (
                  <p className="mt-1.5 text-xs text-red-600 font-medium">
                    {joinFieldErrors.meetingId}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="display-name" className="block text-sm font-semibold text-gray-700 mb-1">
                  Display Name
                </label>
                <input
                  id="display-name"
                  type="text"
                  value={joinDisplayName}
                  onChange={(e) => setJoinDisplayName(e.target.value)}
                  placeholder="Enter your name"
                  disabled={isJoining}
                  className={`w-full px-3.5 py-2 border rounded-xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors text-gray-900 ${
                    joinFieldErrors.displayName ? "border-red-300 focus:ring-red-500 focus:border-red-500" : "border-gray-300"
                  }`}
                />
                {joinFieldErrors.displayName && (
                  <p className="mt-1.5 text-xs text-red-600 font-medium">
                    {joinFieldErrors.displayName}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsJoinOpen(false);
                    setJoinError(null);
                    setJoinFieldErrors({});
                  }}
                  disabled={isJoining}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isJoining}
                  className="flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand/90 text-white rounded-lg text-sm font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 transition-colors disabled:opacity-75 disabled:cursor-not-allowed"
                >
                  {isJoining && (
                    <svg className="w-4 h-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  Join Meeting
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Meeting Modal */}
      {isScheduleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity">
          <div 
            className="w-full max-w-md bg-white rounded-2xl border border-border p-6 shadow-xl transition-all"
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-modal-title"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 id="schedule-modal-title" className="text-xl font-bold text-gray-900">
                Schedule a Meeting
              </h2>
              <button
                type="button"
                onClick={() => {
                  if (!isScheduling) {
                    setIsScheduleOpen(false);
                    setScheduleError(null);
                    setScheduleFieldErrors({});
                  }
                }}
                disabled={isScheduling}
                className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {scheduleError && (
              <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700 border border-red-200 flex items-start gap-2.5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 flex-shrink-0 mt-0.5">
                  <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
                </svg>
                <p>{scheduleError}</p>
              </div>
            )}

            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              <div>
                <label htmlFor="schedule-title" className="block text-sm font-semibold text-gray-700 mb-1">
                  Meeting Title
                </label>
                <input
                  id="schedule-title"
                  type="text"
                  value={scheduleTitle}
                  onChange={(e) => setScheduleTitle(e.target.value)}
                  placeholder="e.g. Daily Sync"
                  disabled={isScheduling}
                  className={`w-full px-3.5 py-2 border rounded-xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors text-gray-900 ${
                    scheduleFieldErrors.title ? "border-red-300 focus:ring-red-500 focus:border-red-500" : "border-gray-300"
                  }`}
                />
                {scheduleFieldErrors.title && (
                  <p className="mt-1.5 text-xs text-red-600 font-medium">
                    {scheduleFieldErrors.title}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="schedule-description" className="block text-sm font-semibold text-gray-700 mb-1">
                  Description <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  id="schedule-description"
                  value={scheduleDescription}
                  onChange={(e) => setScheduleDescription(e.target.value)}
                  placeholder="Describe the meeting agenda or notes..."
                  disabled={isScheduling}
                  rows={2}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors text-gray-900 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="schedule-date" className="block text-sm font-semibold text-gray-700 mb-1">
                    Date
                  </label>
                  <input
                    id="schedule-date"
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    disabled={isScheduling}
                    className={`w-full px-3.5 py-2 border rounded-xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors text-gray-900 ${
                      scheduleFieldErrors.date ? "border-red-300 focus:ring-red-500 focus:border-red-500" : "border-gray-300"
                    }`}
                  />
                  {scheduleFieldErrors.date && (
                    <p className="mt-1.5 text-xs text-red-600 font-medium">
                      {scheduleFieldErrors.date}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="schedule-time" className="block text-sm font-semibold text-gray-700 mb-1">
                    Time
                  </label>
                  <input
                    id="schedule-time"
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    disabled={isScheduling}
                    className={`w-full px-3.5 py-2 border rounded-xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors text-gray-900 ${
                      scheduleFieldErrors.time ? "border-red-300 focus:ring-red-500 focus:border-red-500" : "border-gray-300"
                    }`}
                  />
                  {scheduleFieldErrors.time && (
                    <p className="mt-1.5 text-xs text-red-600 font-medium">
                      {scheduleFieldErrors.time}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="schedule-duration" className="block text-sm font-semibold text-gray-700 mb-1">
                  Duration <span className="text-gray-400 font-normal">(Minutes)</span>
                </label>
                <input
                  id="schedule-duration"
                  type="number"
                  min={1}
                  max={1440}
                  value={scheduleDuration}
                  onChange={(e) => setScheduleDuration(e.target.value)}
                  disabled={isScheduling}
                  className={`w-full px-3.5 py-2 border rounded-xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors text-gray-900 ${
                    scheduleFieldErrors.duration ? "border-red-300 focus:ring-red-500 focus:border-red-500" : "border-gray-300"
                  }`}
                />
                {scheduleFieldErrors.duration && (
                  <p className="mt-1.5 text-xs text-red-600 font-medium">
                    {scheduleFieldErrors.duration}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsScheduleOpen(false);
                    setScheduleError(null);
                    setScheduleFieldErrors({});
                  }}
                  disabled={isScheduling}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isScheduling}
                  className="flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand/90 text-white rounded-lg text-sm font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 transition-colors disabled:opacity-75 disabled:cursor-not-allowed"
                >
                  {isScheduling && (
                    <svg className="w-4 h-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  Schedule Meeting
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
