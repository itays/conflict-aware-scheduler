import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import {
  CalendarClockIcon,
  Link2Icon,
  PencilIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useId, useRef } from "react"
import { flushSync } from "react-dom"
import { Button } from "@/components/ui/button"
import {
  type Conflict,
  conflictsInvolving,
  type FreeSlot,
  findConflicts,
  findFreeSlots,
  MINUTES_PER_DAY,
  nextFreeStart,
  type Schedule,
  type Session,
  sessionEnd,
  sortByStart,
} from "@/schedule/schedule"
import { formatDuration, formatTimeRange } from "@/schedule/time"
import { ConflictFocusBar } from "./conflict-focus-bar"
import { EmptySchedule } from "./empty-schedule"
import { useSchedule } from "./schedule-provider"
import {
  type ConflictFocus,
  conflictParam,
  type SessionEditing,
  sessionElement,
} from "./scheduler-page"

/** Moves a session to a start, then finds focus a home it can keep. */
type MoveSession = (session: Session, start: number) => void

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

export function AgendaView({
  onAddSession,
  onEditSession,
  focus,
}: SessionEditing & ConflictFocus) {
  const { schedule, dispatch } = useSchedule()
  const showAll = useRef<HTMLAnchorElement>(null)
  const focused = focus && conflictsInvolving(schedule, focus)

  // The button that moved the session is gone once it leaves its conflict,
  // so focus follows the session to its new row, or falls back to "Show all"
  // when the filter hides that row.
  const moveSession: MoveSession = (session, start) => {
    flushSync(() =>
      dispatch({ type: "update", session: { ...session, start } })
    )
    ;(sessionElement(session.id) ?? showAll.current)?.focus()
  }

  const items: AgendaItem[] = focused
    ? focused.map((conflict) => ({
        kind: "conflict",
        start: conflict.sessions[0].start,
        conflict,
      }))
    : agendaItems(schedule)

  return (
    <section aria-labelledby="agenda-heading" className="flex flex-col gap-3">
      <h2 id="agenda-heading" className="sr-only">
        Agenda
      </h2>
      {focused && (
        <ConflictFocusBar
          view="agenda"
          clearRef={showAll}
          conflicts={focused}
          verb="Showing only"
          clearLabel="Show all"
        />
      )}
      {schedule.length === 0 ? (
        <EmptySchedule onAddSession={onAddSession} />
      ) : (
        <ol aria-labelledby="agenda-heading" className="flex flex-col gap-2">
          {items.map((item, index) => (
            <li key={`${item.kind}-${item.start}`}>
              {/* Two neighbours with no free slot between them can only be
                back-to-back: had they shared a minute, they would be one
                conflict. */}
              {index > 0 &&
                !focused &&
                item.kind !== "free" &&
                items[index - 1].kind !== "free" && <BackToBackNote />}
              {item.kind === "session" && (
                <SessionRow
                  session={item.session}
                  onEdit={onEditSession}
                  className="rounded-xl border"
                />
              )}
              {item.kind === "conflict" && (
                <ConflictCard
                  conflict={item.conflict}
                  onEdit={onEditSession}
                  onMove={moveSession}
                />
              )}
              {item.kind === "free" && <FreeSlotRow slot={item.slot} />}
            </li>
          ))}
        </ol>
      )}
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
  return <span className="tabular-nums">{formatTimeRange(start, end)}</span>
}

/** A session's time and title columns, shared by every Agenda row. */
function SessionSummary({
  session,
  titleId,
}: {
  session: Session
  titleId?: string
}) {
  const end = sessionEnd(session)
  return (
    <>
      <span className="flex w-28 shrink-0 flex-col sm:w-32">
        <span className="font-medium">
          <TimeRange start={session.start} end={end} />
        </span>
        {end > MINUTES_PER_DAY && (
          <span className="text-xs text-chart-3">ends next day</span>
        )}
      </span>
      <span aria-hidden className="size-2 shrink-0 rounded-xs bg-chart-2" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span id={titleId} className="font-medium">
          {session.title}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatDuration(session.duration)}
        </span>
      </span>
    </>
  )
}

function SessionRow({
  session,
  onEdit,
  className,
}: {
  session: Session
  onEdit: SessionEditing["onEditSession"]
  className?: string
}) {
  return (
    <button
      type="button"
      data-session-id={session.id}
      onClick={(event) => onEdit(session, event.currentTarget)}
      className={cn(
        "flex w-full items-center gap-4 bg-card px-4 py-3 text-left text-sm outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
        className
      )}
    >
      <SessionSummary session={session} />
    </button>
  )
}

function ConflictCard({
  conflict,
  onEdit,
  onMove,
}: {
  conflict: Conflict
  onEdit: SessionEditing["onEditSession"]
  onMove: MoveSession
}) {
  const { schedule } = useSchedule()
  const headingId = `conflict-${conflict.sessions[0].id}`
  return (
    <section
      aria-labelledby={headingId}
      className="overflow-hidden rounded-xl border border-destructive"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 bg-destructive/10 px-4 py-2.5">
        <h3
          id={headingId}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-destructive"
        >
          <TriangleAlertIcon aria-hidden className="size-4" />
          <span>{conflict.sessions.length} sessions overlap</span>{" "}
          <TimeRange start={conflict.start} end={conflict.end} />
        </h3>
        <Link
          to="/"
          search={{ view: "day", conflict: conflictParam(conflict.sessions) }}
          className="rounded-md text-sm font-medium text-destructive underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-destructive/40"
        >
          Show in Day view
        </Link>
      </div>
      <ul aria-label="Sessions" className="divide-y">
        {conflict.sessions.map((session) => (
          <li key={session.id}>
            <ConflictSessionRow
              session={session}
              freeStart={nextFreeStart(schedule, session)}
              onEdit={onEdit}
              onMove={onMove}
            />
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

/**
 * A session in a conflict card with its fixes. Its buttons are described by
 * its title, so each reads as "Edit, Hiring sync" in a list of several.
 */
function ConflictSessionRow({
  session,
  freeStart,
  onEdit,
  onMove,
}: {
  session: Session
  /** Where "Move to next free slot" puts it; unset when nothing fits. */
  freeStart: number | undefined
  onEdit: SessionEditing["onEditSession"]
  onMove: MoveSession
}) {
  const titleId = useId()
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-card px-4 py-3 text-sm">
      <SessionSummary session={session} titleId={titleId} />
      <span className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          aria-describedby={titleId}
          disabled={freeStart === undefined}
          onClick={() => freeStart !== undefined && onMove(session, freeStart)}
        >
          <CalendarClockIcon aria-hidden />
          {freeStart === undefined ? (
            "No free slot today"
          ) : (
            <>
              Move to next free slot{" "}
              <span className="text-muted-foreground tabular-nums">
                {formatTimeRange(freeStart, freeStart + session.duration)}
              </span>
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          aria-describedby={titleId}
          data-session-id={session.id}
          onClick={(event) => onEdit(session, event.currentTarget)}
        >
          <PencilIcon aria-hidden />
          Edit
        </Button>
      </span>
    </div>
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
