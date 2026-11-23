import { act, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { renderApp } from "@/test/render-app"

function dayView() {
  return screen.queryByRole("region", { name: "Day" })
}

function viewSwitch() {
  return within(screen.getByRole("navigation", { name: "View" }))
}

describe("view switch", () => {
  it("opens on the Day view when no view is given", async () => {
    await renderApp("/")
    expect(dayView()).toBeInTheDocument()
    expect(viewSwitch().getByRole("link", { name: "Day" })).toHaveAttribute(
      "aria-current",
      "page"
    )
  })

  it("moves from Day to Agenda and back", async () => {
    const { router, user } = await renderApp("/?view=day")

    await user.click(viewSwitch().getByRole("link", { name: "Agenda" }))
    expect(
      await screen.findByRole("list", { name: "Agenda" })
    ).toBeInTheDocument()
    expect(router.state.location.search).toEqual({ view: "agenda" })
    expect(dayView()).toBeNull()

    await user.click(viewSwitch().getByRole("link", { name: "Day" }))
    expect(
      await screen.findByRole("region", { name: "Day" })
    ).toBeInTheDocument()
    expect(router.state.location.search).toEqual({ view: "day" })
  })

  it("works with the keyboard", async () => {
    const { router, user } = await renderApp("/?view=agenda")
    const dayLink = viewSwitch().getByRole("link", { name: "Day" })

    while (document.activeElement !== dayLink) await user.tab()
    await user.keyboard("{Enter}")

    expect(
      await screen.findByRole("region", { name: "Day" })
    ).toBeInTheDocument()
    expect(router.state.location.search).toEqual({ view: "day" })
  })
})

describe("today's date", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it.each(["day", "agenda"])("shows above the %s view", async (view) => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 10, 22, 9, 0))
    await renderApp(`/?view=${view}`)
    const date = screen.getByText("Sunday, November 22")
    expect(date.closest("time")).toHaveAttribute("datetime", "2026-11-22")
  })

  it("rolls over to the next day at midnight", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 10, 22, 23, 59, 30))
    await renderApp("/?view=day")
    expect(screen.getByText("Sunday, November 22")).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    const date = screen.getByText("Monday, November 23")
    expect(date.closest("time")).toHaveAttribute("datetime", "2026-11-23")
  })
})
