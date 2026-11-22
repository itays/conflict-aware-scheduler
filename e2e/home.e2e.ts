import { expect, test } from "@playwright/test"

test("app loads the sample day", { tag: "@smoke" }, async ({ page }) => {
  const pageErrors: Error[] = []
  page.on("pageerror", (error) => pageErrors.push(error))

  await page.goto("/")

  await expect(page).toHaveTitle("Scheduler")
  await expect(page.getByRole("status")).toHaveText("2 conflicts · 5 sessions")

  await expect(
    page.getByRole("list", { name: "Sessions" }).getByText("Hiring sync")
  ).toBeVisible()

  await page
    .getByRole("navigation", { name: "View" })
    .getByRole("link", { name: "Agenda" })
    .click()
  await expect(page).toHaveURL(/view=agenda/)
  await expect(
    page.getByRole("region", { name: "3 sessions overlap 10:30 – 11:15" })
  ).toBeVisible()

  expect(pageErrors).toEqual([])
})
