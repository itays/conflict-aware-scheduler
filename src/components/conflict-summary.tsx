import { Link } from "@tanstack/react-router"
import { CircleCheckIcon, TriangleAlertIcon } from "lucide-react"
import { findConflicts } from "@/schedule/schedule"
import { useSchedule } from "./schedule-provider"

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? "" : "s"}`

export function ConflictSummary() {
  const { schedule } = useSchedule()
  const conflicts = findConflicts(schedule)
  const sessionsInConflict = conflicts.reduce(
    (sum, c) => sum + c.sessions.length,
    0
  )

  if (conflicts.length === 0) {
    return (
      <p
        role="status"
        className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm text-muted-foreground"
      >
        <CircleCheckIcon aria-hidden className="size-4" />
        No conflicts
      </p>
    )
  }

  // The status wraps the link so a count change is still announced, and the
  // link opens the Agenda, where each conflict card offers its fixes.
  return (
    <p role="status">
      <Link
        to="/"
        search={{ view: "agenda" }}
        title="Review conflicts in the Agenda"
        className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive outline-none hover:bg-destructive/20 focus-visible:ring-3 focus-visible:ring-destructive/40"
      >
        <TriangleAlertIcon aria-hidden className="size-4" />
        {plural(conflicts.length, "conflict")} ·{" "}
        {plural(sessionsInConflict, "session")}
      </Link>
    </p>
  )
}
