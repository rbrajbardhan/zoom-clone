import { Meeting } from "@/lib/types";
import { formatDateTime, formatDuration, formatStatus, getStatusBadgeClass } from "@/lib/utils";

interface MeetingCardProps {
  meeting: Meeting;
  actionLabel: string;
}

export default function MeetingCard({ meeting, actionLabel }: MeetingCardProps) {
  const isInstant = meeting.meeting_type === "instant";
  
  return (
    <div className="flex flex-col justify-between rounded-xl border border-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div>
        <div className="mb-2 flex items-start justify-between gap-4">
          <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">
            {meeting.title}
          </h3>
          <span
            className={`whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getStatusBadgeClass(
              meeting.status
            )}`}
          >
            {formatStatus(meeting.status)}
          </span>
        </div>
        
        {meeting.description && (
          <p className="mb-4 text-sm text-gray-500 line-clamp-2">
            {meeting.description}
          </p>
        )}

        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4 text-gray-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <span>
              {isInstant ? "Instant meeting" : formatDateTime(meeting.scheduled_at)}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4 text-gray-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <span>{formatDuration(meeting.duration_minutes)}</span>
          </div>

          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4 text-gray-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
            <span className="font-mono text-xs tracking-wide">
              ID: {meeting.meeting_id}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <button
          type="button"
          className="w-full rounded-lg bg-surface px-4 py-2.5 text-sm font-semibold text-brand border border-brand/20 transition-colors hover:bg-brand hover:text-white"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
