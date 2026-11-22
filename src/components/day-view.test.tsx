import { act, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
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

  it("folds the sessions past the third lane into +N, which opens their conflict", async () => {
    const { router, user } = await renderDay(crowded)
    expect(sessionList().getAllByRole("listitem")).toHaveLength(3)
    for (const title of ["A", "B", "C"]) expect(blockFor(title)).toBeVisible()
    for (const title of ["D", "E"])
      expect(sessionList().queryByText(title)).toBeNull()

    const more = screen.getByRole("link", { name: "+2 more sessions" })
    expect(more).toHaveTextContent("+2")

    await user.click(more)
    expect(router.state.location.search).toEqual({
      view: "agenda",
      conflict: "D,E",
    })
  })
})

describe("DayView keyboard dragging", () => {
  async function pickUp(title: string, schedule?: Schedule) {
    const app = await renderDay(schedule)
    const button = within(blockFor(title)).getByRole("button")
    button.focus()
    await app.user.keyboard(" ")
    return { ...app, button }
  }

  const announced = (text: string) =>
    expect(screen.getByText(text)).toHaveAttribute("aria-live", "assertive")

  it("moves a session 30 minutes later with Space, ArrowDown twice, Space", async () => {
    const { user } = await pickUp("Hiring sync")
    announced("Picked up Hiring sync at 10:30")

    await user.keyboard("{ArrowDown}")
    announced("Hiring sync at 10:45")
    await user.keyboard("{ArrowDown}")
    announced("Hiring sync at 11:00")

    await user.keyboard(" ")
    announced("Hiring sync moved to 11:00, overlaps 1 session")
    expect(blockFor("Hiring sync")).toHaveTextContent("11:00 – 11:45")
    expect(screen.getByRole("status")).toHaveTextContent(
      "2 conflicts · 5 sessions"
    )
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("says when a dropped session overlaps nothing, back-to-back included", async () => {
    const pair: Schedule = [
      { id: "a", title: "Design review", start: 9 * 60 + 30, duration: 60 },
      { id: "b", title: "Retro", start: 10 * 60 + 15, duration: 60 },
    ]
    const { user } = await pickUp("Retro", pair)
    await user.keyboard("{ArrowUp}")
    announced("Retro at 10:00")
    await user.keyboard("{ArrowDown}{ArrowDown} ")
    announced("Retro moved to 10:30, no overlaps")
  })

  it("puts the session back on Esc, and Enter still opens the editor", async () => {
    const { user, button } = await pickUp("Hiring sync")
    await user.keyboard("{ArrowDown}{Escape}")
    announced("Move cancelled. Hiring sync stays at 10:30")
    expect(blockFor("Hiring sync")).toHaveTextContent("10:30 – 11:15")
    expect(button).toHaveFocus()

    await user.keyboard("{Enter}")
    expect(
      await screen.findByRole("dialog", { name: "Edit session" })
    ).toBeInTheDocument()
  })

  it("drops in place without opening the editor", async () => {
    const { user } = await pickUp("Hiring sync")
    await user.keyboard(" ")
    announced("Hiring sync stays at 10:30, overlaps 2 sessions")
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("stops at 23:55 and 00:00, and the first press back moves again", async () => {
    const late: Schedule = [
      { id: "late", title: "Late", start: 23 * 60 + 30, duration: 30 },
      { id: "early", title: "Early", start: 10, duration: 30 },
    ]
    const { user } = await pickUp("Late", late)
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}")
    announced("Late at 23:55, the latest start")
    await user.keyboard("{ArrowUp}")
    announced("Late at 23:45")
    await user.keyboard(" ")
    announced("Late moved to 23:45, no overlaps")

    const early = within(blockFor("Early")).getByRole("button")
    early.focus()
    await user.keyboard(" {ArrowUp}{ArrowUp}")
    announced("Early at 00:00, the earliest start")
    await user.keyboard("{ArrowDown}")
    announced("Early at 00:10")
  })

  it("names each block's button by title and time, and says how to pick it up", async () => {
    await renderDay()
    const button = within(blockFor("Hiring sync")).getByRole("button")
    expect(button).toHaveAccessibleName(/Hiring sync.*10:30 – 11:15/)
    expect(button).toHaveAccessibleDescription(
      "Press Space to pick up, the up and down arrows to move 15 minutes, Space to drop and Escape to cancel."
    )
  })
})

describe("DayView's date header", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("shows today's date", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 10, 22, 9, 0))
    await renderDay()
    const date = within(screen.getByRole("region", { name: "Day" })).getByText(
      "Sunday, November 22"
    )
    expect(date.closest("time")).toHaveAttribute("datetime", "2026-11-22")
  })

  it("rolls over to the next day at midnight", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 10, 22, 23, 59, 30))
    await renderDay()
    expect(screen.getByText("Sunday, November 22")).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    const date = screen.getByText("Monday, November 23")
    expect(date.closest("time")).toHaveAttribute("datetime", "2026-11-23")
  })
})
