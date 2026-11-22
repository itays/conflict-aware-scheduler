import { describe, expect, it } from "vitest"
import { sampleDay } from "./sample-day"
import {
  findConflicts,
  findFreeSlots,
  type Schedule,
  type Session,
  scheduleReducer,
  sessionEnd,
} from "./schedule"
import { formatDuration, formatTime } from "./time"

let nextId = 0
function session(title: string, start: string, duration: number): Session {
  nextId += 1
  return { id: `s${nextId}`, title, start: toMinutes(start), duration }
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

function conflictTitles(schedule: Schedule): string[][] {
  return findConflicts(schedule).map((conflict) =>
    conflict.sessions.map((s) => s.title)
  )
}

describe("findConflicts", () => {
  it("finds none in an empty schedule", () => {
    expect(findConflicts([])).toEqual([])
  })

  it("does not flag back-to-back sessions", () => {
    const schedule = [
      session("A", "09:00", 60),
      session("B", "10:00", 30),
      session("C", "08:30", 30),
    ]
    expect(findConflicts(schedule)).toEqual([])
  })

  it("flags a session fully contained in another", () => {
    const outer = session("Outer", "09:00", 120)
    const inner = session("Inner", "09:30", 30)
    const [conflict] = findConflicts([outer, inner])
    expect(conflict.sessions).toEqual([outer, inner])
    expect(conflict.overlaps).toEqual([
      { sessions: [outer, inner], start: 570, end: 600, minutes: 30 },
    ])
  })

  it("flags two identical sessions", () => {
    const first = session("Same", "14:00", 45)
    const second = session("Same", "14:00", 45)
    const conflicts = findConflicts([first, second])
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].overlaps.map((o) => o.minutes)).toEqual([45])
  })

  it("groups a chain of three into one conflict made of two overlaps", () => {
    const schedule = [
      session("C", "10:15", 45),
      session("A", "09:00", 60),
      session("B", "09:30", 60),
    ]
    const conflicts = findConflicts(schedule)
    expect(conflictTitles(schedule)).toEqual([["A", "B", "C"]])
    expect(
      conflicts[0].overlaps.map((o) => [
        o.sessions[0].title,
        o.sessions[1].title,
        o.minutes,
      ])
    ).toEqual([
      ["A", "B", 30],
      ["B", "C", 15],
    ])
    expect(conflicts[0].start).toBe(toMinutes("09:30"))
    expect(conflicts[0].end).toBe(toMinutes("10:30"))
  })

  it("keeps two separate conflicts apart, in start order", () => {
    const schedule = [
      session("Late 1", "14:00", 30),
      session("Late 2", "14:15", 30),
      session("Calm", "12:00", 60),
      session("Early 1", "09:00", 60),
      session("Early 2", "09:45", 30),
    ]
    expect(conflictTitles(schedule)).toEqual([
      ["Early 1", "Early 2"],
      ["Late 1", "Late 2"],
    ])
  })

  it("flags a session running past midnight against a late session", () => {
    const handoff = session("Handoff", "23:30", 60)
    const late = session("Late", "23:45", 10)
    const [conflict] = findConflicts([handoff, late])
    expect(sessionEnd(handoff)).toBe(1470)
    expect(conflict.overlaps[0].minutes).toBe(10)
  })
})

describe("findFreeSlots", () => {
  it("is the whole day for an empty schedule", () => {
    expect(findFreeSlots([])).toEqual([{ start: 0, end: 1440 }])
  })

  it("lists stretches before, between and after sessions", () => {
    const schedule = [
      session("B", "12:00", 60),
      session("A", "09:00", 60),
      session("A2", "10:00", 30),
    ]
    expect(findFreeSlots(schedule)).toEqual([
      { start: toMinutes("00:00"), end: toMinutes("09:00") },
      { start: toMinutes("10:30"), end: toMinutes("12:00") },
      { start: toMinutes("13:00"), end: 1440 },
    ])
  })

  it("leaves no slot inside overlapping sessions", () => {
    const schedule = [session("A", "00:00", 600), session("B", "01:00", 60)]
    expect(findFreeSlots(schedule)).toEqual([{ start: 600, end: 1440 }])
  })

  it("ends the day at midnight when a session runs past it", () => {
    const schedule = [session("Handoff", "23:30", 60)]
    expect(findFreeSlots(schedule)).toEqual([
      { start: 0, end: toMinutes("23:30") },
    ])
  })
})

describe("sampleDay", () => {
  it("matches the design boards", () => {
    const schedule = sampleDay()
    expect(schedule).toHaveLength(11)
    const conflicts = findConflicts(schedule)
    expect(conflicts).toHaveLength(2)
    expect(conflicts.flatMap((c) => c.sessions)).toHaveLength(5)
    expect(schedule.some((s) => sessionEnd(s) > 1440)).toBe(true)
  })
})

describe("scheduleReducer", () => {
  it("clears the day and loads the sample day", () => {
    const cleared = scheduleReducer(sampleDay(), { type: "clear" })
    expect(cleared).toEqual([])
    expect(scheduleReducer(cleared, { type: "loadSampleDay" })).toEqual(
      sampleDay()
    )
  })
})

describe("formatTime", () => {
  it("shows 24-hour HH:mm and wraps past midnight", () => {
    expect(formatTime(0)).toBe("00:00")
    expect(formatTime(toMinutes("09:05"))).toBe("09:05")
    expect(formatTime(toMinutes("23:55"))).toBe("23:55")
    expect(formatTime(1440)).toBe("24:00")
    expect(formatTime(1470)).toBe("00:30")
  })
})

describe("formatDuration", () => {
  it("uses minutes under two hours and hours beyond", () => {
    expect(formatDuration(30)).toBe("30 min")
    expect(formatDuration(90)).toBe("90 min")
    expect(formatDuration(120)).toBe("2 h")
    expect(formatDuration(345)).toBe("5 h 45 min")
    expect(formatDuration(1440)).toBe("24 h")
  })
})
