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
