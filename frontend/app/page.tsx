import Navbar from "@/components/Navbar";
import QuickActions from "@/components/QuickActions";
import UpcomingMeetings from "@/components/UpcomingMeetings";
import RecentMeetings from "@/components/RecentMeetings";

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-12">
          {/* Header */}
          <section>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Good afternoon, Raj 👋
            </h1>
            <p className="mt-2 text-lg text-gray-500">
              Start or schedule your next meeting.
            </p>
          </section>

          {/* Quick Actions */}
          <section>
            <QuickActions />
          </section>

          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
            {/* Upcoming Meetings */}
            <section>
              <UpcomingMeetings />
            </section>

            {/* Recent Meetings */}
            <section>
              <RecentMeetings />
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
