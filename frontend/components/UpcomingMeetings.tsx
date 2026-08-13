"use client";

import { useEffect, useState } from "react";
import { getUpcomingMeetings } from "@/lib/api";
import { Meeting } from "@/lib/types";
import MeetingCard from "./MeetingCard";

export default function UpcomingMeetings() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMeetings = async () => {
    try {
      setError(null);
      const data = await getUpcomingMeetings();
      setMeetings(data);
    } catch (err: unknown) {
      const apiError = err as { detail?: string };
      setError(apiError.detail || "Unable to load upcoming meetings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMeetings();

    const handleRefresh = () => {
      setLoading(true);
      fetchMeetings();
    };

    window.addEventListener("meeting-scheduled", handleRefresh);
    return () => {
      window.removeEventListener("meeting-scheduled", handleRefresh);
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Upcoming Meetings</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Upcoming Meetings</h2>
        <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-center text-red-600">
          <p className="mb-4">{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              fetchMeetings();
            }}
            className="rounded-lg bg-red-100 px-4 py-2 text-sm font-medium hover:bg-red-200"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (meetings.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Upcoming Meetings</h2>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-surface py-12 text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="mb-3 h-10 w-10 text-gray-400"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900">No upcoming meetings</h3>
          <p className="mt-1 text-sm text-gray-500">
            Schedule your next meeting to see it here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-foreground">Upcoming Meetings</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {meetings.map((meeting) => (
          <MeetingCard key={meeting.meeting_id} meeting={meeting} actionLabel="Join Meeting" />
        ))}
      </div>
    </div>
  );
}
