import {
  findConflicts,
  groupByOverlap,
  MINUTES_PER_DAY,
  type Schedule,
  type Session,
  sessionEnd,
} from "./schedule"

export type TimeRange = { start: number; end: number }

/** Where a session sits on the Day view's grid, in minutes of the day. */
export type DayBlock = {
  session: Session
  /** Column of its group of overlapping sessions, counted from 0. */
  lane: number
  /** Columns its group splits the width into. */
  lanes: number
  top: number
  /** The session's end, held at the bottom of the grid. */
  bottom: number
  continuesTomorrow: boolean
  inConflict: boolean
  /** Minutes this session shares with any other, merged and in order. */
  sharedRanges: TimeRange[]
}

export type DayOverflow = {
  sessions: Session[]
  lane: number
  lanes: number
  top: number
  bottom: number
}

export type DayLayout = {
  blocks: DayBlock[]
  overflows: DayOverflow[]
  conflictMarkers: TimeRange[]
}

/** Lanes shown side by side before the rest fold into one overflow column. */
export const MAX_LANES = 3

export function dayLayout(schedule: Schedule): DayLayout {
  const blocks: DayBlock[] = []
  const overflows: DayOverflow[] = []

  for (const group of groupByOverlap(schedule)) {
    const lanes = assignLanes(group)
    const needed = Math.max(...lanes) + 1
    const columns = needed > MAX_LANES ? MAX_LANES + 1 : needed
    const hidden: Session[] = []

    group.forEach((session, index) => {
      if (lanes[index] >= MAX_LANES) {
        hidden.push(session)
        return
      }
      blocks.push({
        session,
        lane: lanes[index],
        lanes: columns,
        top: session.start,
        bottom: clampToDay(sessionEnd(session)),
        continuesTomorrow: sessionEnd(session) > MINUTES_PER_DAY,
        inConflict: group.length > 1,
        sharedRanges: sharedRanges(session, group),
      })
    })

    if (hidden.length > 0) {
      overflows.push({
        sessions: hidden,
        lane: MAX_LANES,
        lanes: columns,
        top: Math.min(...hidden.map((s) => s.start)),
        bottom: clampToDay(Math.max(...hidden.map(sessionEnd))),
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

function sharedRanges(session: Session, group: Session[]): TimeRange[] {
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
