import { screen, waitFor, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { Schedule } from "@/schedule/schedule"
import { renderApp } from "@/test/render-app"

const summary = () => screen.getByRole("status")

function card(name: string | RegExp) {
  return within(screen.getByRole("region", { name }))
}

/** A card's controls for one session, described by that session's title. */
function sessionButton(name: string | RegExp, title: string) {
  return screen.getByRole("button", { name, description: title })
}

const pair: Schedule = [
  { id: "review", title: "Review", start: 600, duration: 60 },
  { id: "sync", title: "Sync", start: 630, duration: 30 },
  { id: "lunch", title: "Lunch", start: 720, duration: 60 },
]

describe("Move to next free slot", () => {
  it("removes a two-session conflict's card and lowers the header count", async () => {
    const { user } = await renderApp("/?view=agenda")
    expect(summary()).toHaveTextContent("2 conflicts · 5 sessions")

    await user.click(
      sessionButton(/^Move to next free slot/, "Recruiter debrief")
    )

    expect(summary()).toHaveTextContent("1 conflict · 3 sessions")
    expect(
      screen.queryByRole("region", { name: /^2 sessions overlap/ })
    ).toBeNull()
    expect(
      screen.getByRole("button", { name: /Recruiter debrief/ })
    ).toHaveFocus()
  })

  it("names where the session will go", async () => {
    await renderApp("/?view=agenda")
    expect(
      sessionButton(/^Move to next free slot/, "Hiring sync")
    ).toHaveAccessibleName("Move to next free slot 17:45 – 18:30")
  })

  it("is disabled and says so when nothing fits today", async () => {
    await renderApp("/?view=agenda", [
      { id: "all-day", title: "All day", start: 0, duration: 1440 },
      { id: "late", title: "Late", start: 1380, duration: 60 },
    ])
    expect(sessionButton("No free slot today", "Late")).toBeDisabled()
  })
})

describe("Edit in a conflict card", () => {
  it("opens the shared dialog for that session", async () => {
    const { user } = await renderApp("/?view=agenda", pair)
    await user.click(sessionButton("Edit", "Sync"))
    expect(
      await screen.findByRole("dialog", { name: "Edit session" })
    ).toBeVisible()
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("Sync")
  })
})

describe("Show in Day view", () => {
  it("switches to the Day view and highlights the conflict's sessions", async () => {
    const { router, user } = await renderApp("/?view=agenda")
    await user.click(
      card("3 sessions overlap 10:30 – 11:15").getByRole("link", {
        name: "Show in Day view",
      })
    )

    const day = within(await screen.findByRole("region", { name: "Day" }))
    expect(router.state.location.search.view).toBe("day")
    const highlighted = day
      .getAllByRole("listitem")
      .filter((block) => within(block).queryByText("Highlighted"))
      .map((block) => block.getAttribute("title"))
    expect(highlighted).toEqual([
      "System design — Omer Levi, 10:00 – 11:00",
      "Hiring sync, 10:30 – 11:15",
      "Room 4B hold, 10:45 – 11:30",
    ])

    await user.click(day.getByRole("link", { name: "Clear highlight" }))
    expect(router.state.location.search).toEqual({ view: "day" })
    expect(screen.queryByText("Highlighted")).toBeNull()
  })
})

describe("opening the Agenda from elsewhere", () => {
  it("opens the Agenda from the header's conflict summary", async () => {
    const { router, user } = await renderApp("/?view=day")
    await user.click(
      screen.getByRole("link", { name: "2 conflicts · 5 sessions" })
    )
    expect(
      await screen.findByRole("list", { name: "Agenda" })
    ).toBeInTheDocument()
    expect(router.state.location.search).toEqual({ view: "agenda" })
  })

  it("opens the Agenda filtered to the +N conflict, with a way back", async () => {
    const crowded: Schedule = [
      ...["A", "B", "C", "D"].map((title) => ({
        id: title,
        title,
        start: 540,
        duration: 60,
      })),
      { id: "x", title: "X", start: 900, duration: 60 },
      { id: "y", title: "Y", start: 930, duration: 60 },
    ]
    const { router, user } = await renderApp("/?view=day", crowded)
    await user.click(screen.getByRole("link", { name: "+1 more session" }))

    const agenda = await screen.findByRole("region", { name: "Agenda" })
    expect(within(agenda).getAllByRole("region")).toHaveLength(1)
    expect(
      card("4 sessions overlap 09:00 – 10:00").getAllByRole("button", {
        name: "Edit",
      })
    ).toHaveLength(4)
    expect(screen.queryByText("X")).toBeNull()

    await user.click(screen.getByRole("link", { name: "Show all" }))
    expect(router.state.location.search).toEqual({ view: "agenda" })
    expect(
      screen.getAllByRole("region", { name: /sessions overlap/ })
    ).toHaveLength(2)
  })

  it("keeps the rest of a filtered conflict after one session moves out", async () => {
    const { user } = await renderApp(
      "/?view=agenda&conflict=system-design,hiring-sync,room-hold"
    )
    await user.click(sessionButton(/^Move to next free slot/, "Hiring sync"))
    await waitFor(() =>
      expect(
        screen.getByRole("region", { name: "2 sessions overlap 10:45 – 11:00" })
      ).toBeInTheDocument()
    )
    expect(screen.getByRole("link", { name: "Show all" })).toHaveFocus()
  })

  it("says so once the filtered conflict is resolved", async () => {
    const { user } = await renderApp("/?view=agenda&conflict=review,sync", pair)
    await user.click(sessionButton(/^Move to next free slot/, "Sync"))
    expect(screen.getByText("This conflict is resolved.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Show all" })).toHaveFocus()
  })
})
