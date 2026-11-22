import { describe, expect, it } from "vitest"
import {
  parseTime,
  type SessionDraft,
  validateSessionDraft,
} from "./session-draft"

const valid: SessionDraft = { title: "Standup", start: "09:00", duration: "30" }

function errorsFor(change: Partial<SessionDraft>) {
  const result = validateSessionDraft({ ...valid, ...change })
  return result.ok ? {} : result.errors
}

describe("parseTime", () => {
  it.each([
    ["00:00", 0],
    ["09:05", 545],
    ["9:30", 570],
    ["23:55", 1435],
  ])("reads %s as %i minutes", (text, minutes) => {
    expect(parseTime(text)).toBe(minutes)
  })

  it.each(["", "9", "0930", "24:00", "12:60", "ab:cd", "-1:00", "12:5"])(
    "rejects %j",
    (text) => {
      expect(parseTime(text)).toBeUndefined()
    }
  )
})

describe("validateSessionDraft", () => {
  it("accepts a valid draft and trims the title", () => {
    expect(validateSessionDraft({ ...valid, title: "  Standup  " })).toEqual({
      ok: true,
      value: { title: "Standup", start: 540, duration: 30 },
    })
  })

  it("rejects a title that is empty after trimming", () => {
    expect(errorsFor({ title: "   " }).title).toBe("Enter a title.")
  })

  it("accepts an 80-character title and rejects 81", () => {
    expect(errorsFor({ title: "a".repeat(80) }).title).toBeUndefined()
    expect(errorsFor({ title: "a".repeat(81) }).title).toBe(
      "Keep the title to 80 characters or fewer."
    )
  })

  it("counts the title length after trimming", () => {
    expect(errorsFor({ title: ` ${"a".repeat(80)} ` }).title).toBeUndefined()
  })

  it("rejects a start time that does not parse", () => {
    expect(errorsFor({ start: "nine" }).start).toBe(
      "Enter a time as HH:mm, from 00:00 to 23:55."
    )
  })

  it("rejects a start after 23:55", () => {
    expect(errorsFor({ start: "23:55" }).start).toBeUndefined()
    expect(errorsFor({ start: "23:57" }).start).toBe(
      "Enter a time as HH:mm, from 00:00 to 23:55."
    )
  })

  it("rejects a start off the 5-minute steps", () => {
    expect(errorsFor({ start: "09:02" }).start).toBe(
      "Start on a 5-minute step, such as 09:00 or 09:05."
    )
  })

  it.each(["5", "1440", "90"])("accepts a duration of %s minutes", (d) => {
    expect(errorsFor({ duration: d }).duration).toBeUndefined()
  })

  it.each([
    ["0", "below 5 minutes"],
    ["1445", "over 24 hours"],
    ["42", "not a multiple of 5"],
    ["", "empty"],
    ["30.5", "fractional"],
    ["abc", "not a number"],
  ])("rejects a duration of %j (%s)", (duration) => {
    expect(errorsFor({ duration }).duration).toBe(
      "Use 5 minutes to 24 hours, in 5-minute steps."
    )
  })

  it("reports every invalid field at once", () => {
    expect(
      Object.keys(errorsFor({ title: "", start: "x", duration: "1" }))
    ).toEqual(["title", "start", "duration"])
  })
})
