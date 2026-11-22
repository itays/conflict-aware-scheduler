import { screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { Schedule } from "@/schedule/schedule"
import { renderApp } from "@/test/render-app"

function renderAgenda(initialSchedule?: Schedule) {
  return renderApp("/?view=agenda", initialSchedule)
}

function agendaRows() {
  const list = screen.getByRole("list", { name: "Agenda" })
  return Array.from(list.children, (item) => item.textContent)
}

describe("AgendaView on the sample day", () => {
  it("summarises the conflicts in the header", async () => {
    await renderAgenda()
    expect(screen.getByRole("status")).toHaveTextContent(
      "2 conflicts · 5 sessions"
    )
  })

  it("lists sessions, free slots and conflicts in start order", async () => {
    await renderAgenda()
    expect(agendaRows()).toEqual([
      "00:00 – 08:30Free · 8 h 30 min",
      "08:30 – 09:00Standup sync30 min",
      "Back-to-back, no conflict09:00 – 10:00Phone screen — Maya Cohen60 min",
      expect.stringMatching(
        /^Back-to-back, no conflict3 sessions overlap 10:30 – 11:15/
      ),
      "11:30 – 12:00Free · 30 min",
      "12:00 – 13:00Lunch with candidate60 min",
      "13:00 – 13:30Free · 30 min",
      expect.stringMatching(/^2 sessions overlap 14:00 – 14:15/),
      "14:30 – 15:00Free · 30 min",
      "15:00 – 16:30Take-home review — Noa B.90 min",
      "16:30 – 17:00Free · 30 min",
      "17:00 – 17:45Panel wrap-up45 min",
      "17:45 – 23:30Free · 5 h 45 min",
      "23:30 – 00:30ends next dayOn-call handoff60 min",
    ])
  })

  it("shows each overlap of a conflict with the minutes it shares", async () => {
    await renderAgenda()
    const card = screen.getByRole("region", {
      name: "3 sessions overlap 10:30 – 11:15",
    })
    expect(
      within(card)
        .getAllByRole("listitem")
        .map((item) => item.textContent)
    ).toEqual([
      "10:00 – 11:00System design — Omer Levi60 minMove to next free slot 17:45 – 18:45Edit",
      "10:30 – 11:15Hiring sync45 minMove to next free slot 17:45 – 18:30Edit",
      "10:45 – 11:30Room 4B hold45 minMove to next free slot 11:15 – 12:00Edit",
      "System design — Omer Levi × Hiring sync30 min",
      "System design — Omer Levi × Room 4B hold15 min",
      "Hiring sync × Room 4B hold30 min",
    ])
  })
})

describe("AgendaView on an empty day", () => {
  it("shows an empty state with a way to add the first session", async () => {
    await renderAgenda([])
    expect(screen.getByRole("status")).toHaveTextContent("No conflicts")
    expect(screen.queryByRole("list", { name: "Agenda" })).toBeNull()
    expect(screen.getByText("Nothing scheduled")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Add the first session" })
    ).toBeInTheDocument()
  })
})
