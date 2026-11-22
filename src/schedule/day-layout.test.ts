import { describe, expect, it } from "vitest"
import { dayLayout } from "./day-layout"
import type { Session } from "./schedule"

function session(title: string, start: string, duration: number): Session {
  return { id: title, title, start: toMinutes(start), duration }
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

describe("dayLayout", () => {
  it("gives a lone session the full width and no conflict", () => {
    const standup = session("Standup", "08:30", 30)
    expect(dayLayout([standup])).toEqual({
      blocks: [
        {
          session: standup,
          lane: 0,
          lanes: 1,
          top: toMinutes("08:30"),
          bottom: toMinutes("09:00"),
          continuesTomorrow: false,
          inConflict: false,
          sharedRanges: [],
        },
      ],
      overflows: [],
      conflictMarkers: [],
    })
  })

  it("puts overlapping sessions side by side", () => {
    const layout = dayLayout([
      session("Debrief", "14:00", 30),
      session("Culture", "13:30", 45),
    ])
    expect(
      layout.blocks.map(({ session, lane, lanes }) => [
        session.title,
        lane,
        lanes,
      ])
    ).toEqual([
      ["Culture", 0, 2],
      ["Debrief", 1, 2],
    ])
  })

  it("hatches only the minutes each session shares with another", () => {
    const layout = dayLayout([
      session("System design", "10:00", 60),
      session("Hiring sync", "10:30", 45),
      session("Room hold", "10:45", 45),
    ])
    expect(
      layout.blocks.map(({ session, lane, lanes, sharedRanges }) => ({
        title: session.title,
        lane,
        lanes,
        shared: sharedRanges.map(({ start, end }) => [start, end]),
      }))
    ).toEqual([
      {
        title: "System design",
        lane: 0,
        lanes: 3,
        shared: [[toMinutes("10:30"), toMinutes("11:00")]],
      },
      {
        title: "Hiring sync",
        lane: 1,
        lanes: 3,
        shared: [[toMinutes("10:30"), toMinutes("11:15")]],
      },
      {
        title: "Room hold",
        lane: 2,
        lanes: 3,
        shared: [[toMinutes("10:45"), toMinutes("11:15")]],
      },
    ])
  })

  it("hatches a session's separate overlaps as separate ranges", () => {
    const layout = dayLayout([
      session("Workshop", "09:00", 180),
      session("Call", "09:30", 30),
      session("Review", "11:00", 30),
    ])
    expect(layout.blocks[0].sharedRanges).toEqual([
      { start: toMinutes("09:30"), end: toMinutes("10:00") },
      { start: toMinutes("11:00"), end: toMinutes("11:30") },
    ])
    expect(layout.blocks.map((b) => b.lane)).toEqual([0, 1, 1])
  })

  it("marks the time range of each conflict for the hour gutter", () => {
    const layout = dayLayout([
      session("System design", "10:00", 60),
      session("Hiring sync", "10:30", 45),
      session("Room hold", "10:45", 45),
      session("Lunch", "12:00", 60),
      session("Culture", "13:30", 45),
      session("Debrief", "14:00", 30),
      session("On-call", "23:30", 60),
      session("Night shift", "23:45", 60),
    ])
    expect(layout.conflictMarkers).toEqual([
      { start: toMinutes("10:30"), end: toMinutes("11:15") },
      { start: toMinutes("14:00"), end: toMinutes("14:15") },
      { start: toMinutes("23:45"), end: 1440 },
    ])
  })

  it("shows up to three lanes without folding any session", () => {
    const layout = dayLayout([
      session("A", "09:00", 60),
      session("B", "09:00", 60),
      session("C", "09:00", 60),
    ])
    expect(layout.blocks).toHaveLength(3)
    expect(layout.overflows).toEqual([])
  })

  it("folds sessions past the third lane into an overflow", () => {
    const layout = dayLayout([
      session("A", "09:00", 60),
      session("B", "09:00", 60),
      session("C", "09:15", 60),
      session("D", "09:30", 30),
      session("E", "09:45", 60),
      session("Lunch", "12:00", 60),
    ])
    expect(
      layout.blocks.map(({ session, lane, lanes }) => [
        session.title,
        lane,
        lanes,
      ])
    ).toEqual([
      ["A", 0, 4],
      ["B", 1, 4],
      ["C", 2, 4],
      ["Lunch", 0, 1],
    ])
    expect(layout.overflows).toEqual([
      {
        sessions: [
          expect.objectContaining({ title: "D" }),
          expect.objectContaining({ title: "E" }),
        ],
        lane: 3,
        lanes: 4,
        top: toMinutes("09:30"),
        bottom: toMinutes("10:45"),
      },
    ])
  })

  it("still hatches the minutes visible sessions share with folded ones", () => {
    const layout = dayLayout([
      session("A", "08:45", 120),
      session("B", "09:00", 30),
      session("C", "09:00", 30),
      session("Folded", "09:15", 30),
    ])
    expect(layout.overflows[0].sessions.map((s) => s.title)).toEqual(["Folded"])
    expect(layout.blocks[0].sharedRanges).toEqual([
      { start: toMinutes("09:00"), end: toMinutes("09:45") },
    ])
  })

  it("keeps back-to-back sessions full width and out of conflict", () => {
    const layout = dayLayout([
      session("Standup", "08:30", 30),
      session("Phone screen", "09:00", 60),
    ])
    expect(
      layout.blocks.map(({ lane, lanes, inConflict, sharedRanges }) => ({
        lane,
        lanes,
        inConflict,
        sharedRanges,
      }))
    ).toEqual([
      { lane: 0, lanes: 1, inConflict: false, sharedRanges: [] },
      { lane: 0, lanes: 1, inConflict: false, sharedRanges: [] },
    ])
    expect(layout.conflictMarkers).toEqual([])
  })

  it("draws a session running past midnight to the bottom of the grid", () => {
    const [block] = dayLayout([session("On-call", "23:30", 60)]).blocks
    expect(block).toMatchObject({
      top: toMinutes("23:30"),
      bottom: 1440,
      continuesTomorrow: true,
    })
  })

  it("does not mark a session ending exactly at midnight as continuing", () => {
    const [block] = dayLayout([session("Late", "23:00", 60)]).blocks
    expect(block).toMatchObject({ bottom: 1440, continuesTomorrow: false })
  })
})
