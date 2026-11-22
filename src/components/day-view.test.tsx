import { screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { sampleDay } from "@/schedule/sample-day"
import type { Schedule } from "@/schedule/schedule"
import { renderApp } from "@/test/render-app"

function renderDay(schedule?: Schedule) {
  return renderApp("/?view=day", schedule)
}

function sessionList() {
  return within(screen.getByRole("list", { name: "Sessions" }))
}

function blockFor(title: string) {
  const block = sessionList().getByText(title).closest("li")
  if (!block) throw new Error(`No block for ${title}`)
  return block
}

describe("DayView on the sample day", () => {
  it("labels every hour of the day in 24-hour time", async () => {
    await renderDay()
    const labels = screen.getAllByText(/^\d\d:00$/).map((l) => l.textContent)
    expect(labels).toEqual(
      Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`)
    )
  })

  it("shows each sample session by name with its time range", async () => {
    await renderDay()
    expect(sessionList().getAllByRole("listitem")).toHaveLength(
      sampleDay().length
    )
    for (const { title } of sampleDay()) {
      expect(blockFor(title)).toBeInTheDocument()
    }
    expect(blockFor("Standup sync")).toHaveTextContent(
      "Standup sync08:30 – 09:00"
    )
  })

  it("marks the sessions in a conflict, not back-to-back ones", async () => {
    await renderDay()
    const marked = sessionList()
      .getAllByRole("listitem")
      .filter((block) => within(block).queryByText("In conflict"))
      .map((block) => block.textContent)
    expect(marked).toEqual([
      expect.stringContaining("System design — Omer Levi"),
      expect.stringContaining("Hiring sync"),
      expect.stringContaining("Room 4B hold"),
      expect.stringContaining("Culture interview"),
      expect.stringContaining("Recruiter debrief"),
    ])
  })

  it("cues a session running past midnight as continuing tomorrow", async () => {
    await renderDay()
    expect(blockFor("On-call handoff")).toHaveTextContent(
      "On-call handoff23:30 – 00:30continues tomorrow"
    )
    expect(blockFor("Panel wrap-up")).not.toHaveTextContent(
      "continues tomorrow"
    )
  })

  it("marks each conflict's time range in the hour gutter", async () => {
    await renderDay()
    const markers = within(screen.getByRole("list", { name: "Conflicts" }))
      .getAllByRole("listitem")
      .map((marker) => marker.textContent)
    expect(markers).toEqual([
      "Conflict 10:30 – 11:15",
      "Conflict 14:00 – 14:15",
    ])
  })
})

describe("DayView with more than three overlapping sessions", () => {
  const crowded: Schedule = ["A", "B", "C", "D", "E"].map((title) => ({
    id: title,
    title,
    start: 9 * 60,
    duration: 60,
  }))

  it("folds the sessions past the third lane into +N", async () => {
    const { router, user } = await renderDay(crowded)
    expect(sessionList().getAllByRole("listitem")).toHaveLength(3)
    for (const title of ["A", "B", "C"]) expect(blockFor(title)).toBeVisible()
    for (const title of ["D", "E"])
      expect(sessionList().queryByText(title)).toBeNull()

    const more = screen.getByRole("link", { name: "+2 more sessions" })
    expect(more).toHaveTextContent("+2")

    await user.click(more)
    expect(router.state.location.search).toEqual({ view: "agenda" })
  })
})
