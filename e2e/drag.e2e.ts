import { expect, type Locator, type Page, test } from "@playwright/test"

/** Presses on a block and moves the mouse `dy` pixels (one per minute). */
async function startDrag(page: Page, block: Locator, dy: number) {
  const box = await block.boundingBox()
  if (!box) throw new Error("Block is not visible")
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y + dy, { steps: 10 })
}

test.beforeEach(async ({ page }) => {
  await page.goto("/?view=day")
  await page.waitForLoadState("networkidle")
})

function dayBlock(page: Page, title: string) {
  return page
    .getByRole("region", { name: "Day" })
    .getByRole("listitem", { name: new RegExp(`^${title},`) })
}

test("dropping a session onto another adds a conflict", async ({ page }) => {
  const status = page.getByRole("status")
  await expect(status).toHaveText("2 conflicts · 5 sessions")

  await startDrag(page, dayBlock(page, "Standup sync"), 30)
  await expect(page.locator("[data-drag-label]")).toHaveText("09:00")
  await page.mouse.up()

  await expect(dayBlock(page, "Standup sync")).toHaveAccessibleName(
    "Standup sync, 09:00 – 09:30"
  )
  await expect(status).toHaveText("3 conflicts · 7 sessions")
  await expect(page.getByRole("dialog")).toHaveCount(0)
})

test("Esc returns a dragged session to its start", async ({ page }) => {
  await startDrag(page, dayBlock(page, "Standup sync"), 30)
  await page.keyboard.press("Escape")
  await page.mouse.up()

  await expect(dayBlock(page, "Standup sync")).toHaveAccessibleName(
    "Standup sync, 08:30 – 09:00"
  )
  await expect(page.getByRole("status")).toHaveText("2 conflicts · 5 sessions")
  await expect(page.locator("[data-drag-label]")).toHaveCount(0)
})

test("releasing over the block after Esc does not open the editor", async ({
  page,
}) => {
  await startDrag(page, dayBlock(page, "Standup sync"), 10)
  await page.keyboard.press("Escape")
  await page.waitForTimeout(200)
  await page.mouse.up()

  await expect(page.getByRole("dialog")).toHaveCount(0)
})

test("each arrow press moves one step while the grid scrolls", async ({
  page,
}) => {
  // From 17:00, the presses scroll the grid, then Panel wrap-up changes lane
  // as it reaches On-call handoff at 23:30.
  const wrapUp = dayBlock(page, "Panel wrap-up").getByRole("button")
  await wrapUp.focus()
  await page.keyboard.press("Space")
  for (let i = 0; i < 26; i++) await page.keyboard.press("ArrowDown")
  await expect(page.locator("[data-drag-label]")).toHaveText("23:30")
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("ArrowUp")
  await expect(page.locator("[data-drag-label]")).toHaveText("23:45")
  await page.keyboard.press("Space")

  await expect(dayBlock(page, "Panel wrap-up")).toHaveAccessibleName(
    "Panel wrap-up, 23:45 – 00:30"
  )
  await expect(page.locator("[data-drag-announcer]")).toHaveText(
    "Panel wrap-up moved to 23:45, overlaps 1 session"
  )
  await expect(page.getByRole("dialog")).toHaveCount(0)
})

test("a drag that scrolled the grid keeps its place on changing lane", async ({
  page,
}) => {
  // Panel wrap-up is held by its middle at the grid's bottom edge until the
  // grid stops scrolling. That point is 23:45 for its start; on the way it
  // joins On-call handoff's conflict and narrows to a lane.
  const grid = await page
    .getByRole("region", { name: "Day" })
    .locator(".overflow-y-auto")
    .boundingBox()
  if (!grid) throw new Error("Grid is not visible")
  const label = page.locator("[data-drag-label]")
  await dayBlock(page, "Panel wrap-up").scrollIntoViewIfNeeded()
  await startDrag(page, dayBlock(page, "Panel wrap-up"), 10)
  const box = await dayBlock(page, "Panel wrap-up").boundingBox()
  const x = (box?.x ?? 0) + (box?.width ?? 0) / 2
  const edge = grid.y + grid.height - 3
  let last = ""
  for (let still = 0, i = 0; still < 10 && i < 200; i++) {
    await page.mouse.move(x, edge + (i % 2))
    await page.waitForTimeout(50)
    const now = (await label.textContent()) ?? ""
    still = now === last ? still + 1 : 0
    last = now
  }
  expect(last).toBe("23:45")

  await page.mouse.move(x, grid.y + grid.height + 20, { steps: 3 })
  await expect(label).toHaveText("23:55")
  await page.mouse.up()
  await expect(dayBlock(page, "Panel wrap-up")).toHaveAccessibleName(
    "Panel wrap-up, 23:55 – 00:40"
  )
})
