import { screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
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
