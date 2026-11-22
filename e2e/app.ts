import type { Page } from "@playwright/test"

/** Opens the app and waits for hydration: earlier clicks are dropped. */
export async function open(page: Page, search: string) {
  await page.goto(`/${search}`)
  await page.waitForLoadState("networkidle")
}

export function dayBlock(page: Page, title: string) {
  return page
    .getByRole("region", { name: "Day" })
    .getByRole("listitem", { name: new RegExp(`^${title},`) })
}

/** The Day view's scrolling time grid. */
export function dayGrid(page: Page) {
  return page.getByRole("region", { name: "Day" }).locator(".overflow-y-auto")
}
