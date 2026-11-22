import { expect, type Page, test } from "@playwright/test"
import { addSession, dayBlock, open } from "./app"

const morning = "3 sessions overlap 10:30 – 11:15"
const afternoon = "2 sessions overlap 14:00 – 14:15"

function cards(page: Page) {
  return page.getByRole("region", { name: /sessions overlap/ })
}

function cardRow(page: Page, card: string, title: string) {
  return page
    .getByRole("region", { name: card, exact: true })
    .getByRole("list", { name: "Sessions" })
    .getByRole("listitem")
    .filter({ hasText: title })
}

function searchOf(page: Page) {
  return new URL(page.url()).searchParams
}

test("the header summary opens the whole Agenda", async ({ page }) => {
  await open(page, "?view=day")
  await page
    .getByRole("status")
    .getByRole("link", { name: "2 conflicts · 5 sessions" })
    .click()

  await expect(page).toHaveURL(/\?view=agenda$/)
  await expect(cards(page)).toHaveCount(2)
})

test("moving a session to its free slot resolves its conflict", async ({
  page,
}) => {
  await open(page, "?view=agenda")
  await cardRow(page, afternoon, "Recruiter debrief")
    .getByRole("button", { name: "Move to next free slot 14:15 – 14:45" })
    .click()

  await expect(page.getByRole("status")).toHaveText("1 conflict · 3 sessions")
  await expect(cards(page)).toHaveCount(1)
  await expect(page.getByRole("region", { name: afternoon })).toHaveCount(0)
  await expect(page.locator('[data-session-id="debrief"]')).toBeFocused()
})

test("Show in Day view highlights the conflict and scrolls to it", async ({
  page,
}) => {
  await open(page, "?view=agenda")
  await page
    .getByRole("region", { name: morning, exact: true })
    .getByRole("link", { name: "Show in Day view" })
    .click()

  await expect(page).toHaveURL(/view=day/)
  expect(searchOf(page).get("conflict")?.split(",").sort()).toEqual([
    "hiring-sync",
    "room-hold",
    "system-design",
  ])
  await expect(
    page.getByText("Highlighting the conflict at 10:30 – 11:15.")
  ).toBeVisible()
  const conflict = [
    "System design — Omer Levi",
    "Hiring sync",
    "Room 4B hold",
  ].map((title) => dayBlock(page, title))
  await expect(
    page
      .getByRole("region", { name: "Day" })
      .getByRole("list", { name: "Sessions" })
      .getByRole("listitem")
      .filter({ hasText: "Highlighted" })
  ).toHaveCount(3)
  for (const block of conflict) {
    await expect(block).toContainText("Highlighted")
    await expect(block, "the conflict is scrolled into view").toBeInViewport({
      ratio: 1,
    })
  }
  await expect(
    dayBlock(page, "Standup sync"),
    "the grid opens 30 minutes above the conflict, past the first session"
  ).not.toBeInViewport()

  await page.getByRole("link", { name: "Clear highlight" }).click()
  await expect(page).toHaveURL(/\?view=day$/)
  await expect(page.getByText("Highlighted")).toHaveCount(0)
})

test("+N opens the Agenda filtered to its conflict", async ({ page }) => {
  await open(page, "?view=day")
  await addSession(page, "Extra hold", "10:45")
  await page
    .getByRole("region", { name: "Day" })
    .getByRole("link", { name: "+1 more session" })
    .click()

  await expect(page).toHaveURL(/view=agenda/)
  expect(searchOf(page).get("conflict")).toBe("room-hold")
  await expect(cards(page)).toHaveCount(1)
  await expect(
    page.getByRole("region", { name: "4 sessions overlap 10:30 – 11:15" })
  ).toBeVisible()
  await expect(
    page.getByText("Showing only the conflict at 10:30 – 11:15.")
  ).toBeVisible()

  await page.getByRole("link", { name: "Show all" }).click()
  await expect(page).toHaveURL(/\?view=agenda$/)
  await expect(cards(page)).toHaveCount(2)
})

test("resolving a filtered conflict moves focus to Show all", async ({
  page,
}) => {
  await open(page, "?view=agenda&conflict=culture,debrief")
  await expect(cards(page)).toHaveCount(1)
  await cardRow(page, afternoon, "Recruiter debrief")
    .getByRole("button", { name: "Move to next free slot 14:15 – 14:45" })
    .click()

  await expect(page.getByText("This conflict is resolved.")).toBeVisible()
  await expect(cards(page)).toHaveCount(0)
  await expect(page.getByRole("link", { name: "Show all" })).toBeFocused()
})
