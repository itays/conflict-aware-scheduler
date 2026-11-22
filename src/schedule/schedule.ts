import { sampleDay } from "./sample-day"

export const MINUTES_PER_DAY = 1440

/**
 * A titled block of time covering [start, start + duration). `start` is
 * minutes from the start of the schedule's day (0–1435, multiples of 5) and
 * `duration` is 5–1440 minutes in steps of 5, so a session may end after
 * midnight (ADR 0002).
 */
export type Session = {
  id: string
  title: string
  start: number
  duration: number
}

export type Schedule = readonly Session[]

export type Overlap = {
  sessions: [Session, Session]
  start: number
  end: number
  minutes: number
}

/** The largest set of sessions linked to each other by overlaps. */
export type Conflict = {
  sessions: Session[]
  overlaps: Overlap[]
  /** First and last minute shared by any two of its sessions. */
  start: number
  end: number
}

export type FreeSlot = { start: number; end: number }

export type ScheduleAction =
  | { type: "add"; session: Session }
  | { type: "update"; session: Session }
  | { type: "delete"; id: string }
  | { type: "clear" }
  | { type: "loadSampleDay" }

export function scheduleReducer(
  schedule: Schedule,
  action: ScheduleAction
): Schedule {
  switch (action.type) {
    case "add":
      return [...schedule, action.session]
    case "update":
      return schedule.map((s) =>
        s.id === action.session.id ? action.session : s
      )
    case "delete":
      return schedule.filter((s) => s.id !== action.id)
    case "clear":
      return []
    case "loadSampleDay":
      return sampleDay()
  }
}

export function sessionEnd(session: Session): number {
  return session.start + session.duration
}

export function sortByStart(schedule: Schedule): Session[] {
  return [...schedule].sort(
    (a, b) => a.start - b.start || sessionEnd(a) - sessionEnd(b)
  )
}

function overlapBetween(a: Session, b: Session): Overlap | undefined {
  const start = Math.max(a.start, b.start)
  const end = Math.min(sessionEnd(a), sessionEnd(b))
  if (start >= end) return undefined
  return { sessions: [a, b], start, end, minutes: end - start }
}

/**
 * The sessions `candidate` would share minutes with, in start order, leaving
 * out the session with its own id so an edit never overlaps itself.
 */
export function overlapsWith(
  schedule: Schedule,
  candidate: Session
): { session: Session; minutes: number }[] {
  return sortByStart(schedule).flatMap((session) => {
    if (session.id === candidate.id) return []
    const overlap = overlapBetween(candidate, session)
    return overlap ? [{ session, minutes: overlap.minutes }] : []
  })
}

/**
 * Sessions in start order, split into groups linked by overlaps. A session
 * that overlaps nothing is a group of one.
 */
export function groupByOverlap(schedule: Schedule): Session[][] {
  // Sorted by start, a run of sessions stays connected while each next one
  // starts before the run's latest end.
  const groups: Session[][] = []
  let groupEnd = -1
  for (const session of sortByStart(schedule)) {
    if (session.start < groupEnd) {
      groups[groups.length - 1].push(session)
    } else {
      groups.push([session])
    }
    groupEnd = Math.max(groupEnd, sessionEnd(session))
  }
  return groups
}

export function findConflicts(schedule: Schedule): Conflict[] {
  return groupByOverlap(schedule)
    .filter((sessions) => sessions.length > 1)
    .map((sessions) => {
      const overlaps = sessions.flatMap((a, i) =>
        sessions.slice(i + 1).flatMap((b) => overlapBetween(a, b) ?? [])
      )
      return {
        sessions,
        overlaps,
        start: Math.min(...overlaps.map((o) => o.start)),
        end: Math.max(...overlaps.map((o) => o.end)),
      }
    })
}

export function findFreeSlots(schedule: Schedule): FreeSlot[] {
  const slots: FreeSlot[] = []
  let cursor = 0
  for (const session of sortByStart(schedule)) {
    if (session.start > cursor)
      slots.push({ start: cursor, end: session.start })
    cursor = Math.max(cursor, sessionEnd(session))
  }
  if (cursor < MINUTES_PER_DAY)
    slots.push({ start: cursor, end: MINUTES_PER_DAY })
  return slots
}
