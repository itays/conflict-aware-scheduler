import {
  findConflicts,
  groupByOverlap,
  MINUTES_PER_DAY,
  type Schedule,
  type Session,
  sessionEnd,
} from "./schedule"

export type TimeRange = { start: number; end: number }

/** Where an item sits on the Day view's grid, in minutes of the day. */
export type LanePlacement = {
  /** Column within its group of overlapping sessions, counted from 0. */
  lane: number
  /** Columns its group splits the width into. */
  lanes: number
  top: number
  /** Held at the bottom of the grid for anything running past midnight. */
  bottom: number
}

export type DayBlock = LanePlacement & {
  session: Session
  continuesTomorrow: boolean
  inConflict: boolean
  /** Minutes this session overlaps any other, merged and in order. */
  overlapRanges: TimeRange[]
}

/** Overlapping sessions folded past the last lane, shown as "+N". */
export type DayOverflow = LanePlacement & { sessions: Session[] }

export type DayLayout = {
  blocks: DayBlock[]
  overflows: DayOverflow[]
  conflictMarkers: TimeRange[]
}

/** Lanes shown side by side before the rest fold into one overflow column. */
const MAX_LANES = 3

/**
 * `keepVisible` names a session that must never fold into "+N", such as one
 * being dragged: it takes the overflow lane and is drawn over the "+N".
 */
export function dayLayout(
  schedule: Schedule,
  { keepVisible }: { keepVisible?: Session["id"] } = {}
): DayLayout {
  const blocks: DayBlock[] = []
  const overflows: DayOverflow[] = []

  for (const group of groupByOverlap(schedule)) {
    const laneOf = assignLanes(group)
    const needed = Math.max(...laneOf) + 1
    const columns = needed > MAX_LANES ? MAX_LANES + 1 : needed
    const hidden: Session[] = []

    group.forEach((session, index) => {
      if (laneOf[index] >= MAX_LANES && session.id !== keepVisible) {
        hidden.push(session)
        return
      }
      blocks.push({
        session,
        lane: Math.min(laneOf[index], MAX_LANES),
        lanes: columns,
        top: session.start,
        bottom: clampToDay(sessionEnd(session)),
        continuesTomorrow: sessionEnd(session) > MINUTES_PER_DAY,
        inConflict: group.length > 1,
        overlapRanges: overlapRanges(session, group),
      })
    })

    // A long session can link crowded stretches hours apart; each stretch
    // gets its own "+N" so none spans minutes where nothing is folded.
    for (const folded of groupByOverlap(hidden)) {
      overflows.push({
        sessions: folded,
        lane: MAX_LANES,
        lanes: columns,
        top: folded[0].start,
        bottom: clampToDay(Math.max(...folded.map(sessionEnd))),
      })
    }
  }

  return {
    blocks,
    overflows,
    conflictMarkers: findConflicts(schedule).map(({ start, end }) => ({
      start,
      end: clampToDay(end),
    })),
  }
}

const clampToDay = (minute: number) => Math.min(minute, MINUTES_PER_DAY)

function overlapRanges(session: Session, group: Session[]): TimeRange[] {
  const ranges = group
    .filter((other) => other !== session)
    .map((other) => ({
      start: Math.max(session.start, other.start),
      end: clampToDay(Math.min(sessionEnd(session), sessionEnd(other))),
    }))
    .filter(({ start, end }) => start < end)
    .sort((a, b) => a.start - b.start)

  const merged: TimeRange[] = []
  for (const range of ranges) {
    const last = merged.at(-1)
    if (last && range.start <= last.end)
      last.end = Math.max(last.end, range.end)
    else merged.push({ ...range })
  }
  return merged
}

/** Each session, in start order, takes the first lane free by its start. */
function assignLanes(sessions: Session[]): number[] {
  const laneEnds: number[] = []
  return sessions.map((session) => {
    let lane = laneEnds.findIndex((end) => end <= session.start)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = sessionEnd(session)
    return lane
  })
}
