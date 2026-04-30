import { CalendarBoard } from "@/components/calendar-board";
import { PageIntro } from "@/components/page-intro";
import { isInUpcomingCalendarWindow } from "@/lib/calendar-window";
import { loadDashboardSnapshot } from "@/lib/data/dashboard";
import { isLiveCalendarEvent } from "@/lib/live-data";

export default async function CalendarPage() {
  const snapshot = await loadDashboardSnapshot();
  const now = new Date();
  const events = [...(snapshot.calendarEvents ?? [])]
    .filter((event) => isLiveCalendarEvent(event) && isInUpcomingCalendarWindow(event.startsAt, now))
    .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime());

  return (
    <div className="space-y-6">
      <PageIntro
        kicker="Икономически календар"
        title="Седмичен календар за събития, които движат златото."
        lead="Показва следващите 7 дни с live ForexFactory събития, официални FRED/BLS/Fed release-и, филтри по важност, тип и валута, плюс локални browser аларми."
      />

      <CalendarBoard events={events} />
    </div>
  );
}
