import { expect, type Locator, test } from "@playwright/test"
import { dayBlock, dayGrid, open } from "./app"

test.beforeEach(async ({ page }) => {
  await open(page, "?view=day")
})

async function box(locator: Locator) {
  const found = await locator.boundingBox()
  if (!found) throw new Error(`${locator} is not visible`)
  return found
}

test("the grid opens at 08:00", async ({ page }) => {
  const grid = dayGrid(page)
  const top = (await box(grid)).y
  const offset = async () => {
    const label = await box(grid.getByText("08:00", { exact: true }))
    return label.y + label.height / 2 - top
  }

  await expect
    .poll(offset, { message: "08:00 sits in the grid's top padding" })
    .toBeLessThanOrEqual(20)
  expect(await offset()).toBeGreaterThanOrEqual(0)
  await expect(
    grid.getByText("07:00", { exact: true }),
    "07:00 is scrolled out above"
  ).not.toBeInViewport()
})

test("overlapping sessions sit in lanes, back-to-back ones stay full width", async ({
  page,
}) => {
  const lanes = await Promise.all(
    ["System design — Omer Levi", "Hiring sync", "Room 4B hold"].map((title) =>
      box(dayBlock(page, title))
    )
  )
  for (const [i, a] of lanes.entries()) {
    for (const b of lanes.slice(i + 1)) {
      expect(
        a.x + a.width <= b.x || b.x + b.width <= a.x,
        "conflicting blocks never cover each other"
      ).toBe(true)
    }
  }

  const sessions = await box(
    page
      .getByRole("region", { name: "Day" })
      .getByRole("list", { name: "Sessions" })
  )
  const standup = await box(dayBlock(page, "Standup sync"))
  const phoneScreen = await box(dayBlock(page, "Phone screen — Maya Cohen"))
  expect(phoneScreen.x).toBe(standup.x)
  expect(phoneScreen.width).toBe(standup.width)
  expect(standup.width, "full width less the hairline").toBeGreaterThan(
    sessions.width - 5
  )
})
