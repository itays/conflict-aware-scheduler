import { screen, waitFor, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { Schedule } from "@/schedule/schedule"
import { renderApp } from "@/test/render-app"

const twoApart: Schedule = [
  { id: "standup", title: "Standup", start: 540, duration: 30 },
  { id: "review", title: "Review", start: 600, duration: 60 },
]

function dialog() {
  return within(screen.getByRole("dialog"))
}

const saveButton = () => dialog().getByRole("button", { name: "Save" })
const titleField = () => dialog().getByRole("textbox", { name: "Title" })
const startField = () => dialog().getByRole("textbox", { name: "Start" })

async function openNewSession(url: string, schedule?: Schedule) {
  const app = await renderApp(url, schedule)
  await app.user.click(screen.getByRole("button", { name: "New session" }))
  await screen.findByRole("dialog")
  return app
}

describe("New session", () => {
  it("opens the dialog with focus on the title", async () => {
    await openNewSession("/", twoApart)
    expect(screen.getByRole("dialog", { name: "New session" })).toBeVisible()
    await waitFor(() => expect(titleField()).toHaveFocus())
  })

  it("saving an overlap updates the header summary and adds an Agenda card", async () => {
    const { user } = await renderApp("/?view=agenda", twoApart)
    expect(screen.getByRole("status")).toHaveTextContent("No conflicts")
    await user.click(screen.getByRole("button", { name: "New session" }))
    await screen.findByRole("dialog")

    await user.type(titleField(), "Hiring sync")
    await user.clear(startField())
    await user.type(startField(), "10:30")
    await user.click(dialog().getByRole("radio", { name: "45 min" }))
    expect(saveButton()).toBeEnabled()
    await user.click(saveButton())

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(screen.getByRole("status")).toHaveTextContent(
      "1 conflict · 2 sessions"
    )
    expect(
      screen.getByRole("region", { name: "2 sessions overlap 10:30 – 11:00" })
    ).toBeInTheDocument()
  })

  it("previews the overlaps as the user types", async () => {
    const { user } = await openNewSession("/", twoApart)
    await user.clear(startField())
    await user.type(startField(), "09:15")
    expect(
      dialog().getByRole("list", { name: "Overlapping sessions" })
    ).toHaveTextContent("Standup 09:00 – 09:3015 min")

    await user.click(dialog().getByRole("radio", { name: "90 min" }))
    expect(
      dialog()
        .getAllByRole("listitem")
        .map((item) => item.textContent)
    ).toEqual(["Standup 09:00 – 09:3015 min", "Review 10:00 – 11:0045 min"])

    await user.clear(startField())
    await user.type(startField(), "12:00")
    expect(dialog().getByText("No overlaps")).toBeInTheDocument()
  })

  it("shows the end time, and says next day past midnight", async () => {
    const { user } = await openNewSession("/", twoApart)
    expect(dialog().getByText("09:30")).toBeInTheDocument()

    await user.clear(startField())
    await user.type(startField(), "23:30")
    await user.click(dialog().getByRole("radio", { name: "60 min" }))
    expect(dialog().getByText("00:30")).toHaveTextContent("00:30next day")
  })

  it("allows a duplicate title", async () => {
    const { user } = await openNewSession("/?view=agenda", twoApart)
    await user.type(titleField(), "Standup")
    await user.clear(startField())
    await user.type(startField(), "15:00")
    await user.click(saveButton())
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(screen.getAllByText("Standup")).toHaveLength(2)
  })

  it("returns focus to the New session button when closed", async () => {
    const { user } = await openNewSession("/", twoApart)
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(screen.getByRole("button", { name: "New session" })).toHaveFocus()
  })
})

describe("invalid input", () => {
  it("disables Save with a field message for each invalid field", async () => {
    const { user } = await openNewSession("/", twoApart)
    expect(saveButton()).toBeDisabled()

    await user.type(titleField(), "   ")
    expect(dialog().getByText("Enter a title.")).toBeInTheDocument()

    await user.clear(titleField())
    await user.type(titleField(), "a".repeat(81))
    expect(
      dialog().getByText("Keep the title to 80 characters or fewer.")
    ).toBeInTheDocument()
    await user.type(titleField(), "{Backspace}")
    expect(saveButton()).toBeEnabled()

    await user.clear(startField())
    await user.type(startField(), "25:00")
    expect(
      dialog().getByText("Enter a time as HH:mm, from 00:00 to 23:55.")
    ).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
    await user.clear(startField())
    await user.type(startField(), "09:00")

    await user.click(dialog().getByRole("radio", { name: "Custom" }))
    const custom = dialog().getByRole("textbox", {
      name: "Custom duration (minutes)",
    })
    await user.clear(custom)
    await user.type(custom, "42")
    expect(
      dialog().getByText("Use 5 minutes to 24 hours, in 5-minute steps.")
    ).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
    await user.clear(custom)
    await user.type(custom, "120")
    expect(saveButton()).toBeEnabled()
  })
})

describe("editing a session", () => {
  it("opens from a Day view block, filled with that session", async () => {
    const { user } = await renderApp("/?view=day", twoApart)
    await user.click(screen.getByRole("button", { name: /Review/ }))
    await screen.findByRole("dialog")
    expect(screen.getByRole("dialog", { name: "Edit session" })).toBeVisible()
    expect(titleField()).toHaveValue("Review")
    expect(startField()).toHaveValue("10:00")
    expect(dialog().getByRole("radio", { name: "60 min" })).toBeChecked()
  })

  it("opens from an Agenda row and saves the change", async () => {
    const { user } = await renderApp("/?view=agenda", twoApart)
    await user.click(screen.getByRole("button", { name: /Standup/ }))
    await screen.findByRole("dialog")
    await user.clear(titleField())
    await user.type(titleField(), "Daily standup")
    await user.click(saveButton())
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(screen.getByText("Daily standup")).toBeInTheDocument()
    expect(screen.queryByText("Standup")).toBeNull()
  })

  it("opens a custom duration in the custom field", async () => {
    const { user } = await renderApp("/?view=agenda", [
      { id: "long", title: "Offsite", start: 540, duration: 120 },
    ])
    await user.click(screen.getByRole("button", { name: /Offsite/ }))
    await screen.findByRole("dialog")
    expect(dialog().getByRole("radio", { name: "Custom" })).toBeChecked()
    expect(
      dialog().getByRole("textbox", { name: "Custom duration (minutes)" })
    ).toHaveValue("120")
  })

  it("returns focus to the session that opened it", async () => {
    const { user } = await renderApp("/?view=agenda", twoApart)
    const row = screen.getByRole("button", { name: /Review/ })
    await user.click(row)
    await screen.findByRole("dialog")
    await user.click(dialog().getByRole("button", { name: "Cancel" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(row).toHaveFocus()
  })

  it("returns focus to the session's row when saving moves it into a conflict", async () => {
    const { user } = await renderApp("/?view=agenda", twoApart)
    await user.click(screen.getByRole("button", { name: /Standup/ }))
    await screen.findByRole("dialog")
    await user.clear(startField())
    await user.type(startField(), "10:15")
    await user.click(saveButton())
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    const card = screen.getByRole("region", { name: /2 sessions overlap/ })
    expect(within(card).getByRole("button", { name: /Standup/ })).toHaveFocus()
  })

  it("moves focus to New session after a delete", async () => {
    const { user } = await renderApp("/?view=agenda", twoApart)
    await user.click(screen.getByRole("button", { name: /Review/ }))
    await screen.findByRole("dialog")
    await user.click(dialog().getByRole("button", { name: "Delete" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(screen.getByRole("button", { name: "New session" })).toHaveFocus()
  })

  it("deletes the session and closes the dialog", async () => {
    const { user } = await renderApp("/?view=agenda", twoApart)
    await user.click(screen.getByRole("button", { name: /Review/ }))
    await screen.findByRole("dialog")
    await user.click(dialog().getByRole("button", { name: "Delete" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(screen.queryByText("Review")).toBeNull()
    expect(screen.getByText("Standup")).toBeInTheDocument()
  })
})

describe("Clear day", () => {
  it.each(["day", "agenda"])(
    "empties the schedule and the %s view offers to add the first session",
    async (view) => {
      const { user } = await renderApp(`/?view=${view}`)
      await user.click(screen.getByRole("button", { name: "Clear day" }))
      expect(screen.getByText("Nothing scheduled")).toBeInTheDocument()
      expect(screen.getByText("No conflicts")).toBeInTheDocument()

      await user.click(
        screen.getByRole("button", { name: "Add the first session" })
      )
      expect(await screen.findByRole("dialog")).toHaveTextContent("New session")
    }
  )
})
