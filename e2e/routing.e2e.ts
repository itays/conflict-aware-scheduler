import { expect, type Page, test } from "@playwright/test"
import { addSession, dayBlock, open } from "./app"

const pageErrors = new WeakMap<Page, Error[]>()

test.beforeEach(({ page }) => {
  const errors: Error[] = []
  pageErrors.set(page, errors)
  page.on("pageerror", (error) => errors.push(error))
})

test.afterEach(({ page }) => {
  expect(pageErrors.get(page), "no page errors").toEqual([])
})

function viewLink(page: Page, name: "Day" | "Agenda") {
  return page.getByRole("navigation", { name: "View" }).getByRole("link", {
    name,
  })
}

test("/ redirects to the Day view", async ({ page }) => {
  const response = await page.request.get("/", { maxRedirects: 0 })
  expect(response.status()).toBe(307)
  const location = new URL(response.headers().location, response.url())
  expect(location.pathname + location.search).toBe("/?view=day")

  await page.goto("/")
  await expect(page).toHaveURL(/\/\?view=day$/)
  await expect(page.getByRole("region", { name: "Day" })).toBeVisible()
})

test("the Agenda survives a reload", async ({ page }) => {
  await open(page, "?view=agenda")
  await expect(page.getByRole("list", { name: "Agenda" })).toBeVisible()

  await page.reload()
  await expect(page).toHaveURL(/\?view=agenda$/)
  await expect(page.getByRole("list", { name: "Agenda" })).toBeVisible()
  await expect(page.getByRole("region", { name: "Day" })).toHaveCount(0)
})

test("an unknown view falls back to the Day view", async ({ page }) => {
  await open(page, "?view=bogus")
  await expect(page.getByRole("region", { name: "Day" })).toBeVisible()
  await expect(viewLink(page, "Day")).toHaveAttribute("aria-current", "page")
})

test("a conflict that matches nothing reads as resolved", async ({ page }) => {
  await open(page, "?view=day&conflict=bogus")
  await expect(page.getByText("This conflict is resolved.")).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Clear highlight" })
  ).toBeVisible()
  await expect(page.getByRole("region", { name: "Day" })).toBeVisible()
})

test("the View switch drops the conflict filter", async ({ page }) => {
  await open(page, "?view=agenda&conflict=culture,debrief")
  await expect(page.getByRole("link", { name: "Show all" })).toBeVisible()

  await viewLink(page, "Day").click()
  await expect(page).toHaveURL(/\?view=day$/)
  await expect(page.getByText(/^Highlighting/)).toHaveCount(0)
})

test("an added session survives a view switch, not a reload", async ({
  page,
}) => {
  await open(page, "?view=day")
  await addSession(page, "Design review", "08:00")
  await expect(dayBlock(page, "Design review")).toHaveAccessibleName(
    "Design review, 08:00 – 08:30"
  )

  await viewLink(page, "Agenda").click()
  await expect(
    page
      .getByRole("list", { name: "Agenda" })
      .getByRole("button", { name: "08:00 – 08:30 Design review 30 min" })
  ).toBeVisible()

  await viewLink(page, "Day").click()
  await expect(dayBlock(page, "Design review")).toBeVisible()

  await page.reload()
  await expect(page.getByRole("status")).toHaveText("2 conflicts · 5 sessions")
  await expect(page.getByRole("region", { name: "Day" })).toBeVisible()
  await expect(dayBlock(page, "Design review")).toHaveCount(0)
})
