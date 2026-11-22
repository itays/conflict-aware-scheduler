import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { ArrowDownIcon, TriangleAlertIcon } from "lucide-react"
import { useEffect, useRef } from "react"
import {
  type DayBlock,
  type DayOverflow,
  dayLayout,
} from "@/schedule/day-layout"
import { MINUTES_PER_DAY, sessionEnd } from "@/schedule/schedule"
import { formatTime } from "@/schedule/time"
import { useSchedule } from "./schedule-provider"

/** One pixel per minute: an hour row is 60px tall. */
const PX_PER_MINUTE = 1
const toPx = (minutes: number) => minutes * PX_PER_MINUTE
const px = (minutes: number) => `${toPx(minutes)}px`
const HOURS = Array.from({ length: 24 }, (_, hour) => hour)
/** Where the grid opens on a day with no sessions. */
const DEFAULT_FIRST_MINUTE = 8 * 60

export function DayView() {
  const { schedule } = useSchedule()
  const layout = dayLayout(schedule)

  // Open the grid just above the first session rather than at midnight.
  const scroller = useRef<HTMLDivElement>(null)
  const hasScrolled = useRef(false)
  const firstMinute = layout.blocks[0]?.top ?? DEFAULT_FIRST_MINUTE
  useEffect(() => {
    if (hasScrolled.current || !scroller.current) return
    scroller.current.scrollTop = toPx(Math.max(0, firstMinute - 30))
    hasScrolled.current = true
  }, [firstMinute])

  return (
    <section aria-labelledby="day-heading">
      <h2 id="day-heading" className="sr-only">
        Day
      </h2>
      <div
        ref={scroller}
        className="h-[calc(100svh-9rem)] min-h-96 overflow-y-auto rounded-xl border bg-card py-3"
      >
        <div className="relative flex" style={{ height: px(MINUTES_PER_DAY) }}>
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
            <ol
              aria-label="Conflicts"
              className="absolute inset-y-0 right-0 w-1"
            >
              {layout.conflictMarkers.map(({ start, end }) => {
                const label = `Conflict ${formatTime(start)} – ${formatTime(end)}`
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
                  <SessionBlock key={block.session.id} block={block} />
                ))}
              </ol>
              {layout.overflows.map((overflow) => (
                <OverflowLink key={overflow.top} overflow={overflow} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/** The sessions folded past the last lane, opened in the Agenda. */
function OverflowLink({ overflow }: { overflow: DayOverflow }) {
  const count = overflow.sessions.length
  return (
    <Link
      to="/"
      search={{ view: "agenda" }}
      title={overflow.sessions.map((s) => s.title).join(", ")}
      className="absolute flex items-start justify-center rounded-md border border-destructive/70 bg-destructive/10 pt-1 text-xs font-medium text-destructive outline-none hover:bg-destructive/20 focus-visible:ring-3 focus-visible:ring-destructive/40"
      style={laneStyle(overflow)}
    >
      +{count}{" "}
      <span className="sr-only">
        more {count === 1 ? "session" : "sessions"}
      </span>
    </Link>
  )
}

/** Places an item in its lane, leaving a hairline between neighbours. */
function laneStyle({
  top,
  bottom,
  lane,
  lanes,
}: {
  top: number
  bottom: number
  lane: number
  lanes: number
}) {
  return {
    top: px(top),
    height: `calc(${px(bottom - top)} - 1px)`,
    left: `calc(${(lane / lanes) * 100}% + 2px)`,
    width: `calc(${100 / lanes}% - 4px)`,
  }
}

function SessionBlock({ block }: { block: DayBlock }) {
  const { session, inConflict } = block
  return (
    <li
      className={cn(
        "absolute overflow-hidden rounded-md border text-xs",
        block.continuesTomorrow && "rounded-b-none border-b-2 border-dashed",
        inConflict
          ? "border-destructive/70 bg-destructive/10 text-destructive"
          : "border-session-border bg-session text-session-foreground"
      )}
      style={laneStyle(block)}
    >
      {block.sharedRanges.map((range) => (
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
      <div
        className={cn(
          "relative flex gap-x-2 px-2 py-1 leading-tight",
          block.bottom - block.top >= 45
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
          <span className="truncate">{session.title}</span>
        </span>
        <span className="truncate tabular-nums opacity-85">
          {formatTime(session.start)} – {formatTime(sessionEnd(session))}
        </span>
        {block.continuesTomorrow && (
          <span className="flex items-center gap-1 font-medium">
            <ArrowDownIcon aria-hidden className="size-3" />
            continues tomorrow
          </span>
        )}
      </div>
    </li>
  )
}
