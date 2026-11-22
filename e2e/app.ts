import { expect, type Page } from "@playwright/test"

export async function openHydrated(page: Page, search: string) {
  await page.goto(`/${search}`)
  await page.waitForLoadState("networkidle")
}

export function dayBlock(page: Page, title: string) {
  return page
    .getByRole("region", { name: "Day" })
    .getByRole("listitem", { name: new RegExp(`^${title},`) })
}

export function dayGrid(page: Page) {
  return page.getByRole("region", { name: "Day" }).locator(".overflow-y-auto")
}

export async function addSession(page: Page, title: string, start: string) {
  await page.getByRole("button", { name: "New session" }).click()
  const dialog = page.getByRole("dialog", { name: "New session" })
  await dialog.getByRole("textbox", { name: "Title" }).fill(title)
  await dialog.getByRole("textbox", { name: "Start" }).fill(start)
  await dialog.getByRole("button", { name: "Save" }).click()
  await expect(dialog).toHaveCount(0)
}
