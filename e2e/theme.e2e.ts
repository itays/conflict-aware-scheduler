import { expect, type Page, test } from "@playwright/test"
import { open } from "./app"

test.use({ colorScheme: "light" })

async function pickTheme(page: Page, name: "Light" | "Dark" | "System") {
  await page.getByRole("button", { name: "Toggle theme" }).click()
  await page.getByRole("menuitemradio", { name }).click()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("menu")).toHaveCount(0)
}

test("Dark survives a reload", async ({ page }) => {
  await open(page, "?view=day")
  const html = page.locator("html")
  await expect(html).not.toContainClass("dark")

  await pickTheme(page, "Dark")
  await expect(html).toContainClass("dark")

  await page.reload()
  await expect(html).toContainClass("dark")
})

test("a stored Dark applies before any app script runs", async ({ page }) => {
  await open(page, "?view=day")
  await pickTheme(page, "Dark")
  await expect(page.locator("html")).toContainClass("dark")

  const blocked: string[] = []
  await page.route(
    (url) => url.pathname.endsWith(".js"),
    (route) => {
      blocked.push(route.request().url())
      return route.abort()
    }
  )
  await page.reload()

  expect(blocked, "the app's scripts were blocked").not.toEqual([])
  await expect(page.locator("html")).toContainClass("dark")
})

test("System follows the browser's colour scheme live", async ({ page }) => {
  await open(page, "?view=day")
  await pickTheme(page, "Dark")
  await pickTheme(page, "System")
  const html = page.locator("html")
  await expect(html).not.toContainClass("dark")

  await page.emulateMedia({ colorScheme: "dark" })
  await expect(html).toContainClass("dark")

  await page.emulateMedia({ colorScheme: "light" })
  await expect(html).not.toContainClass("dark")
})
