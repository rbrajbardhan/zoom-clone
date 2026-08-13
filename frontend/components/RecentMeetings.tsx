"use client";

import { useEffect, useState } from "react";
import { getRecentMeetings } from "@/lib/api";
import { Meeting } from "@/lib/types";
import MeetingCard from "./MeetingCard";

export default function RecentMeetings() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMeetings = async () => {
    try {
      setError(null);
      const data = await getRecentMeetings();
      setMeetings(data);
    } catch (err: unknown) {
      const apiError = err as { detail?: string };
      setError(apiError.detail || "Unable to load recent meetings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMeetings();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Recent Meetings</h2>
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
        <h2 className="text-xl font-semibold text-foreground">Recent Meetings</h2>
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
        <h2 className="text-xl font-semibold text-foreground">Recent Meetings</h2>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-surface py-12 text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="mb-3 h-10 w-10 text-gray-400"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900">No recent meetings</h3>
          <p className="mt-1 text-sm text-gray-500">
            Your completed and past meetings will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-foreground">Recent Meetings</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {meetings.map((meeting) => (
          <MeetingCard
            key={meeting.meeting_id}
            meeting={meeting}
            actionLabel={meeting.status === "active" ? "Rejoin" : "View"}
          />
        ))}
      </div>
    </div>
  );
}
