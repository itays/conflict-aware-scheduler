import { cn } from "cn"
import { Link2Icon, TriangleAlertIcon } from "lucide-react"
import {
  type Conflict,
  type FreeSlot,
  findConflicts,
  findFreeSlots,
  MINUTES_PER_DAY,
  type Schedule,
  type Session,
  sessionEnd,
  sortByStart,
} from "@/schedule/schedule"
import { formatDuration, formatTime } from "@/schedule/time"
import { useSchedule } from "./schedule-provider"

type AgendaItem =
  | { kind: "session"; start: number; session: Session }
  | { kind: "conflict"; start: number; conflict: Conflict }
  | { kind: "free"; start: number; slot: FreeSlot }

/**
 * Sessions outside conflicts, one item per conflict placed at its first
 * session, and the free slots between them, in start order. No two items
 * share a start: a session starting where another does would overlap it.
 */
function agendaItems(schedule: Schedule): AgendaItem[] {
  const conflicts = findConflicts(schedule)
  const inConflict = new Set(
    conflicts.flatMap((c) => c.sessions.map((s) => s.id))
  )
  const items: AgendaItem[] = [
    ...sortByStart(schedule)
      .filter((session) => !inConflict.has(session.id))
      .map((session) => ({
        kind: "session" as const,
        start: session.start,
        session,
      })),
    ...conflicts.map((conflict) => ({
      kind: "conflict" as const,
      start: conflict.sessions[0].start,
      conflict,
    })),
    ...findFreeSlots(schedule).map((slot) => ({
      kind: "free" as const,
      start: slot.start,
      slot,
    })),
  ]
  return items.sort((a, b) => a.start - b.start)
}

export function AgendaView() {
  const { schedule } = useSchedule()

  return (
    <section aria-labelledby="agenda-heading" className="flex flex-col gap-3">
      <h2 id="agenda-heading" className="sr-only">
        Agenda
      </h2>
      <ol aria-labelledby="agenda-heading" className="flex flex-col gap-2">
        {agendaItems(schedule).map((item, index, items) => (
          <li key={`${item.kind}-${item.start}`}>
            {/* Two neighbours with no free slot between them can only be
                back-to-back: had they shared a minute, they would be one
                conflict. */}
            {index > 0 &&
              item.kind !== "free" &&
              items[index - 1].kind !== "free" && <BackToBackNote />}
            {item.kind === "session" && (
              <SessionRow
                session={item.session}
                className="rounded-xl border"
              />
            )}
            {item.kind === "conflict" && (
              <ConflictCard conflict={item.conflict} />
            )}
            {item.kind === "free" && <FreeSlotRow slot={item.slot} />}
          </li>
        ))}
      </ol>
    </section>
  )
}

function BackToBackNote() {
  return (
    <p className="flex items-center gap-1.5 px-4 pb-2 text-xs text-muted-foreground">
      <Link2Icon aria-hidden className="size-3" />
      Back-to-back, no conflict
    </p>
  )
}

function TimeRange({ start, end }: { start: number; end: number }) {
  return (
    <span className="tabular-nums">
      {formatTime(start)} – {formatTime(end)}
    </span>
  )
}

function SessionRow({
  session,
  className,
}: {
  session: Session
  className?: string
}) {
  const end = sessionEnd(session)
  return (
    <div
      className={cn(
        "flex items-center gap-4 bg-card px-4 py-3 text-sm",
        className
      )}
    >
      <div className="flex w-28 shrink-0 flex-col sm:w-32">
        <span className="font-medium">
          <TimeRange start={session.start} end={end} />
        </span>
        {end > MINUTES_PER_DAY && (
          <span className="text-xs text-chart-3">ends next day</span>
        )}
      </div>
      <span aria-hidden className="size-2 shrink-0 rounded-xs bg-chart-2" />
      <div className="flex min-w-0 flex-col">
        <span className="font-medium">{session.title}</span>
        <span className="text-xs text-muted-foreground">
          {formatDuration(session.duration)}
        </span>
      </div>
    </div>
  )
}

function ConflictCard({ conflict }: { conflict: Conflict }) {
  const headingId = `conflict-${conflict.sessions[0].id}`
  return (
    <section
      aria-labelledby={headingId}
      className="overflow-hidden rounded-xl border border-destructive"
    >
      <h3
        id={headingId}
        className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive"
      >
        <TriangleAlertIcon aria-hidden className="size-4" />
        <span>{conflict.sessions.length} sessions overlap</span>{" "}
        <TimeRange start={conflict.start} end={conflict.end} />
      </h3>
      <ul aria-label="Sessions" className="divide-y">
        {conflict.sessions.map((session) => (
          <li key={session.id}>
            <SessionRow session={session} />
          </li>
        ))}
      </ul>
      <div className="border-t bg-muted/40 px-4 py-3 text-sm">
        <h4
          id={`${headingId}-overlaps`}
          className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase"
        >
          Overlaps
        </h4>
        <ul
          aria-labelledby={`${headingId}-overlaps`}
          className="flex flex-col gap-1"
        >
          {conflict.overlaps.map(({ sessions: [a, b], minutes }) => (
            <li key={`${a.id}-${b.id}`} className="flex justify-between gap-4">
              <span>
                {a.title} × {b.title}
              </span>
              <span className="shrink-0 text-destructive tabular-nums">
                {minutes} min
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function FreeSlotRow({ slot }: { slot: FreeSlot }) {
  return (
    <div className="flex items-center gap-4 px-4 py-1 text-xs text-muted-foreground">
      <span className="w-28 shrink-0 sm:w-32">
        <TimeRange start={slot.start} end={slot.end} />
      </span>
      <span aria-hidden className="h-px flex-1 border-t border-dashed" />
      <span>Free · {formatDuration(slot.end - slot.start)}</span>
    </div>
  )
}
