import { DndContext, useDraggable } from "@dnd-kit/core"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { ArrowDownIcon, TriangleAlertIcon } from "lucide-react"
import { type CSSProperties, useEffect, useRef } from "react"
import {
  type DayBlock,
  type DayOverflow,
  dayLayout,
  type LanePlacement,
} from "@/schedule/day-layout"
import {
  conflictsInvolving,
  MINUTES_PER_DAY,
  sessionEnd,
} from "@/schedule/schedule"
import { formatTime, formatTimeRange } from "@/schedule/time"
import { ConflictFocusBar } from "./conflict-focus-bar"
import { EmptySchedule } from "./empty-schedule"
import { useSchedule } from "./schedule-provider"
import {
  type ConflictFocus,
  conflictParam,
  type SessionEditing,
} from "./scheduler-page"
import { useSessionDrag } from "./use-session-drag"

/** One pixel per minute: an hour row is 60px tall. */
const PX_PER_MINUTE = 1
const toPx = (minutes: number) => minutes * PX_PER_MINUTE
const px = (minutes: number) => `${toPx(minutes)}px`
const HOURS = Array.from({ length: 24 }, (_, hour) => hour)
/** Where the grid opens on a day with no sessions. */
const DEFAULT_FIRST_MINUTE = 8 * 60
/** Room left above the first session when the grid opens. */
const SCROLL_LEAD_MINUTES = 30
/** Blocks at least this tall put the time range under the title. */
const STACKED_BLOCK_MINUTES = 45

export function DayView({
  onAddSession,
  onEditSession,
  focus,
}: SessionEditing & ConflictFocus) {
  const { schedule } = useSchedule()
  const { drag, contextProps, announcerRef } = useSessionDrag(PX_PER_MINUTE)
  // While dragging, lay the day out as if the session already sat at its new
  // start, so lanes, hatching, gutter markers and the highlight follow every
  // step.
  const previewSchedule = drag
    ? schedule.map((s) =>
        s.id === drag.session.id ? { ...s, start: drag.start } : s
      )
    : schedule
  const layout = dayLayout(previewSchedule, { keepVisible: drag?.session.id })
  const focused = focus && conflictsInvolving(previewSchedule, focus)
  const highlighted = new Set(
    focused?.flatMap((conflict) => conflict.sessions.map((s) => s.id))
  )

  // Open the grid just above the highlighted conflict, or else the first
  // session, rather than at midnight.
  const scroller = useRef<HTMLDivElement>(null)
  const hasScrolled = useRef(false)
  const firstMinute =
    focused?.[0]?.sessions[0].start ??
    layout.blocks[0]?.top ??
    DEFAULT_FIRST_MINUTE
  useEffect(() => {
    if (hasScrolled.current || !scroller.current) return
    scroller.current.scrollTop = toPx(
      Math.max(0, firstMinute - SCROLL_LEAD_MINUTES)
    )
    hasScrolled.current = true
  }, [firstMinute])

  return (
    <section aria-labelledby="day-heading" className="flex flex-col gap-3">
      <h2 id="day-heading" className="sr-only">
        Day
      </h2>
      {focused && (
        <ConflictFocusBar
          view="day"
          conflicts={focused}
          verb="Highlighting"
          clearLabel="Clear highlight"
        />
      )}
      {schedule.length === 0 ? (
        <EmptySchedule onAddSession={onAddSession} />
      ) : (
        <DndContext {...contextProps}>
          <div ref={announcerRef} hidden />
          <div
            ref={scroller}
            className="h-[calc(100svh-9rem)] min-h-96 overflow-y-auto rounded-xl border bg-card py-3"
          >
            <div
              className="relative flex"
              style={{ height: px(MINUTES_PER_DAY) }}
            >
              <div className="relative w-14 shrink-0">
                <div aria-hidden>
                  {HOURS.map((hour) => (
                    <span
                      key={hour}
                      className="absolute right-3 -translate-y-1/2 text-xs text-muted-foreground tabular-nums"
                      style={{ top: px(hour * 60) }}
                    >
                      {formatTime(hour * 60)}
                    </span>
                  ))}
                </div>
                {drag && (
                  <span
                    aria-hidden
                    data-drag-label
                    className="absolute right-1 z-10 -translate-y-1/2 rounded-sm bg-primary px-1 text-xs font-medium text-primary-foreground tabular-nums"
                    style={{ top: px(drag.start) }}
                  >
                    {formatTime(drag.start)}
                  </span>
                )}
                <ol
                  aria-label="Conflicts"
                  className="absolute inset-y-0 right-0 w-1"
                >
                  {layout.conflictMarkers.map(({ start, end }) => {
                    const label = `Conflict ${formatTimeRange(start, end)}`
                    return (
                      <li
                        key={start}
                        title={label}
                        className="absolute right-0 w-1 rounded-full bg-destructive"
                        style={{ top: px(start), height: px(end - start) }}
                      >
                        <span className="sr-only">{label}</span>
                      </li>
                    )
                  })}
                </ol>
              </div>
              <div className="relative flex-1 border-l">
                <div aria-hidden>
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="absolute inset-x-0 border-t border-dashed first:border-solid"
                      style={{ top: px(hour * 60) }}
                    />
                  ))}
                </div>
                <div className="absolute inset-y-0 right-2 left-0">
                  <ol aria-label="Sessions" className="absolute inset-0">
                    {layout.blocks.map((block) => (
                      <SessionBlock
                        key={block.session.id}
                        block={block}
                        highlighted={highlighted.has(block.session.id)}
                        draggedFrom={
                          block.session.id === drag?.session.id
                            ? drag.session.start
                            : undefined
                        }
                        onEdit={onEditSession}
                      />
                    ))}
                  </ol>
                  {layout.overflows.map((overflow) => (
                    <OverflowLink
                      key={overflow.top}
                      overflow={overflow}
                      highlighted={overflow.sessions.some((s) =>
                        highlighted.has(s.id)
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </DndContext>
      )}
    </section>
  )
}

/** Marks a block, or "+N", that belongs to the highlighted conflict. */
const HIGHLIGHT_RING = "ring-2 ring-primary ring-offset-1 ring-offset-card"

/** The sessions folded past the last lane, opened in the Agenda filtered to
 * their conflict. */
function OverflowLink({
  overflow,
  highlighted,
}: {
  overflow: DayOverflow
  highlighted: boolean
}) {
  const count = overflow.sessions.length
  return (
    <Link
      to="/"
      search={{ view: "agenda", conflict: conflictParam(overflow.sessions) }}
      title={overflow.sessions.map((s) => s.title).join(", ")}
      className={cn(
        "absolute flex items-start justify-center rounded-md border border-destructive/70 bg-destructive/10 pt-1 text-xs font-medium text-destructive outline-none hover:bg-destructive/20 focus-visible:ring-3 focus-visible:ring-destructive/40",
        highlighted && HIGHLIGHT_RING
      )}
      style={laneStyle(overflow)}
    >
      +{count}{" "}
      <span className="sr-only">
        more {count === 1 ? "session" : "sessions"}
      </span>
    </Link>
  )
}

/**
 * Places an item in its lane, leaving a hairline between neighbours. A block
 * being dragged keeps its original top (`draggedFrom`) and is shifted by a
 * transform: dnd-kit measures it ignoring transforms and would subtract any
 * move of its top from the drag distance.
 */
function laneStyle(
  { top, bottom, lane, lanes }: LanePlacement,
  draggedFrom?: number
): CSSProperties {
  return {
    top: px(draggedFrom ?? top),
    transform:
      draggedFrom === undefined
        ? undefined
        : `translateY(${px(top - draggedFrom)})`,
    height: `calc(${px(bottom - top)} - 1px)`,
    left: `calc(${(lane / lanes) * 100}% + 2px)`,
    width: `calc(${100 / lanes}% - 4px)`,
  }
}

function SessionBlock({
  block,
  highlighted,
  draggedFrom,
  onEdit,
}: {
  block: DayBlock
  highlighted: boolean
  /** The start the session had before the drag in progress, if dragged. */
  draggedFrom?: number
  onEdit: SessionEditing["onEditSession"]
}) {
  const { session, inConflict } = block
  const timeRange = formatTimeRange(session.start, sessionEnd(session))
  const { setNodeRef, listeners } = useDraggable({ id: session.id })
  const dragging = draggedFrom !== undefined
  return (
    <li
      ref={setNodeRef}
      // Short sessions are too small for their text; the tooltip keeps it.
      title={`${session.title}, ${timeRange}`}
      className={cn(
        "absolute overflow-hidden rounded-md border text-xs",
        block.continuesTomorrow && "rounded-b-none border-b-2 border-dashed",
        inConflict
          ? "border-destructive/70 bg-destructive/10 text-destructive"
          : "border-session-border bg-session text-session-foreground",
        highlighted && HIGHLIGHT_RING,
        // The dragged block rides above highlighted ones.
        dragging ? "z-20 shadow-lg" : highlighted && "z-10"
      )}
      style={laneStyle(block, draggedFrom)}
    >
      <button
        type="button"
        data-session-id={session.id}
        {...listeners}
        onClick={(event) => onEdit(session, event.currentTarget)}
        className={cn(
          "relative block size-full cursor-pointer touch-manipulation text-left outline-none select-none [-webkit-touch-callout:none] hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:ring-inset",
          dragging && "cursor-grabbing"
        )}
      >
        {block.overlapRanges.map((range) => (
          <span
            key={range.start}
            aria-hidden
            className="absolute inset-x-0 bg-hatch"
            style={{
              top: px(range.start - block.top),
              height: px(range.end - range.start),
            }}
          />
        ))}
        <span
          className={cn(
            "relative flex gap-x-2 px-2 py-1 leading-tight",
            block.bottom - block.top >= STACKED_BLOCK_MINUTES
              ? "flex-col"
              : "flex-wrap items-baseline"
          )}
        >
          <span className="flex min-w-0 items-center gap-1 font-medium">
            {inConflict && (
              <>
                <TriangleAlertIcon aria-hidden className="size-3 shrink-0" />
                <span className="sr-only">In conflict</span>
              </>
            )}
            {highlighted && <span className="sr-only">Highlighted</span>}
            <span className="truncate">{session.title}</span>
          </span>
          <span className="truncate tabular-nums opacity-85">{timeRange}</span>
          {block.continuesTomorrow && (
            <span className="flex items-center gap-1 font-medium">
              <ArrowDownIcon aria-hidden className="size-3" />
              continues tomorrow
            </span>
          )}
        </span>
      </button>
    </li>
  )
}
