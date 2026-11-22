import { describe, expect, it } from "vitest"
import { draggedStart } from "./move"

const at = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

describe("draggedStart", () => {
  it("stays put until the drag reaches half a step", () => {
    expect(draggedStart(at("10:05"), 0)).toBe(at("10:05"))
    expect(draggedStart(at("10:05"), 7)).toBe(at("10:05"))
    expect(draggedStart(at("10:05"), -7)).toBe(at("10:05"))
  })

  it("moves in 15-minute steps counted from the original start", () => {
    expect(draggedStart(at("10:05"), 8)).toBe(at("10:20"))
    expect(draggedStart(at("10:05"), 20)).toBe(at("10:20"))
    expect(draggedStart(at("10:05"), -9)).toBe(at("09:50"))
    expect(draggedStart(at("10:05"), 95)).toBe(at("11:35"))
  })

  it("stops at 00:00 when dragged past the top", () => {
    expect(draggedStart(at("00:10"), -15)).toBe(0)
    expect(draggedStart(at("08:30"), -2000)).toBe(0)
  })

  it("stops at 23:55 when dragged past the bottom", () => {
    expect(draggedStart(at("23:50"), 15)).toBe(at("23:55"))
    expect(draggedStart(at("08:30"), 2000)).toBe(at("23:55"))
  })
})
