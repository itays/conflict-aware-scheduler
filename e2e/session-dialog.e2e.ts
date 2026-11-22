import { expect, test } from "@playwright/test"
import { dayBlock, open } from "./app"

test.beforeEach(async ({ page }) => {
  await open(page, "?view=day")
})

test("a session that overlaps another still saves", async ({ page }) => {
  await page.getByRole("button", { name: "New session" }).click()
  const dialog = page.getByRole("dialog", { name: "New session" })
  await expect(dialog.getByRole("textbox", { name: "Title" })).toBeFocused()
  await dialog.getByRole("textbox", { name: "Title" }).fill("Design review")
  await dialog.getByRole("textbox", { name: "Start" }).fill("12:30")

  await expect(
    dialog
      .getByRole("list", { name: "Overlapping sessions" })
      .getByRole("listitem")
  ).toHaveText([/^Lunch with candidate 12:00 – 13:00\s*30 min$/])
  await expect(dialog.getByRole("button", { name: "Save" })).toBeEnabled()
  await dialog.getByRole("button", { name: "Save" }).click()

  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole("status")).toHaveText("3 conflicts · 7 sessions")
  await expect(dayBlock(page, "Design review")).toHaveAccessibleName(
    "Design review, 12:30 – 13:00"
  )
  await expect(dayBlock(page, "Design review").getByRole("button")).toHaveText(
    /In conflict/
  )
})

test("editing a session past midnight says next day", async ({ page }) => {
  await dayBlock(page, "Panel wrap-up").getByRole("button").click()
  const dialog = page.getByRole("dialog", { name: "Edit session" })
  await expect(dialog.getByRole("textbox", { name: "Title" })).toHaveValue(
    "Panel wrap-up"
  )

  await dialog.getByRole("textbox", { name: "Start" }).fill("23:45")
  await dialog
    .locator("label")
    .filter({ hasText: /^60 min$/ })
    .click()
  await expect(dialog.getByText(/^00:45/)).toHaveText(/^00:45\s*next day$/)
  await dialog.getByRole("button", { name: "Save" }).click()

  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole("status")).toHaveText("3 conflicts · 7 sessions")
  await expect(dayBlock(page, "Panel wrap-up")).toHaveAccessibleName(
    "Panel wrap-up, 23:45 – 00:45"
  )
  await expect(page.locator('[data-session-id="wrap-up"]')).toBeFocused()
})

test("deleting a session from its Day block", async ({ page }) => {
  await dayBlock(page, "Recruiter debrief").getByRole("button").click()
  const dialog = page.getByRole("dialog", { name: "Edit session" })
  await dialog.getByRole("button", { name: "Delete" }).click()

  await expect(dialog).toHaveCount(0)
  await expect(dayBlock(page, "Recruiter debrief")).toHaveCount(0)
  await expect(page.getByRole("status")).toHaveText("1 conflict · 3 sessions")
  await expect(page.getByRole("button", { name: "New session" })).toBeFocused()
})

test("Clear day empties both views", async ({ page }) => {
  await page.getByRole("button", { name: "Clear day" }).click()

  const status = page.getByRole("status")
  await expect(status).toHaveText("No conflicts")
  await expect(status.getByRole("link")).toHaveCount(0)
  const day = page.getByRole("region", { name: "Day" })
  await expect(day.getByText("Nothing scheduled")).toBeVisible()
  await expect(day.getByRole("list", { name: "Sessions" })).toHaveCount(0)

  await page
    .getByRole("navigation", { name: "View" })
    .getByRole("link", { name: "Agenda" })
    .click()
  const agenda = page.getByRole("region", { name: "Agenda" })
  await expect(agenda.getByText("Nothing scheduled")).toBeVisible()
  await expect(page.getByRole("list", { name: "Agenda" })).toHaveCount(0)

  await agenda.getByRole("button", { name: "Add the first session" }).click()
  await expect(page.getByRole("dialog", { name: "New session" })).toBeVisible()
})
