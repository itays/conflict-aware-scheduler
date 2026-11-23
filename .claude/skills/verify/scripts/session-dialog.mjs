#!/usr/bin/env node
// Prove the session dialog end to end: add, the live overlap preview, invalid
// input, edit (including past midnight), delete, focus return, edits that
// survive a view switch, and "Clear day" leading to both empty states.
//
//   node session-dialog.mjs <base-url> <artifact-dir>
//
// Expected summaries and overlaps come from a pairwise oracle over
// src/schedule/sample-day.ts plus each edit this script makes, never from the
// app's own functions. Writes one .png per step and report.json; exits 1 on
// any failed check or page error (a thrown step also writes failure.png).
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { chromium } from "@playwright/test"
import { sampleDay } from "../../../../src/schedule/sample-day.ts"

const [baseUrl, outDir] = process.argv.slice(2)
if (!baseUrl || !outDir) {
  console.error("usage: node session-dialog.mjs <base-url> <artifact-dir>")
  process.exit(2)
}
mkdirSync(outDir, { recursive: true })

// ---- Oracle ---------------------------------------------------------------
const end = (s) => s.start + s.duration
const shared = (a, b) => Math.min(end(a), end(b)) - Math.max(a.start, b.start)
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`
const minutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + m
}
/** Header text for a schedule: conflicts are groups joined by overlaps. */
function summaryOf(schedule) {
  const parent = schedule.map((_, i) => i)
  const root = (i) => (parent[i] === i ? i : root(parent[i]))
  const linked = new Set()
  for (let i = 0; i < schedule.length; i++) {
    for (let j = i + 1; j < schedule.length; j++) {
      if (shared(schedule[i], schedule[j]) <= 0) continue
      parent[root(i)] = root(j)
      linked.add(i).add(j)
    }
  }
  const groups = new Set([...linked].map(root))
  return groups.size === 0
    ? "No conflicts"
    : `${plural(groups.size, "conflict")} · ${plural(linked.size, "session")}`
}

let schedule = sampleDay()
const wrapUpId = schedule.find((s) => s.title === "Panel wrap-up").id
const added = { title: "Design review", start: "12:30", duration: 30 }
const addedSession = {
  id: "added",
  title: added.title,
  start: minutes(added.start),
  duration: added.duration,
}
const expectedPreview = schedule
  .filter((s) => shared(s, addedSession) > 0)
  .map((s) => `${s.title}|${shared(s, addedSession)} min`)

// ---- Drive ----------------------------------------------------------------
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const errors = []
page.on("pageerror", (error) => errors.push(String(error)))
const checks = []
const check = (name, ok, detail) => {
  checks.push({ name, ok: Boolean(ok), detail })
  console.log(
    ok ? "ok  " : "FAIL",
    name,
    detail === undefined ? "" : JSON.stringify(detail)
  )
}
// Let the dialog's fade finish so screenshots show it fully drawn.
const shot = async (name) => {
  await page.waitForTimeout(250)
  await page.screenshot({ path: join(outDir, `${name}.png`) })
}
const dialog = () => page.getByRole("dialog")
const field = (name) => dialog().getByRole("textbox", { name })
// The radios are visually hidden inside their labels; click the label.
const duration = (label) =>
  dialog()
    .locator("label")
    .filter({ hasText: new RegExp(`^${label}$`) })
    .click()
const save = () => dialog().getByRole("button", { name: "Save" })
const closed = () => dialog().waitFor({ state: "detached" })
const status = () => page.getByRole("status").textContent()
const focused = () =>
  page.evaluate(() => document.activeElement?.textContent?.trim() ?? "")
// Every element that stands for a session (Day block, Agenda row, a conflict
// card's Edit button) carries its id, so this survives a move into a card.
const focusedSessionId = () =>
  page.evaluate(() => document.activeElement?.dataset.sessionId ?? "")
const viewLink = (name) =>
  page.getByRole("navigation", { name: "View" }).getByRole("link", { name })

let step = "start"
try {
  step = "open the Agenda"
  await page.goto(`${baseUrl}/?view=agenda`)
  await page.waitForLoadState("networkidle")
  check(
    "summary on load",
    (await status()) === summaryOf(schedule),
    await status()
  )

  step = "add a session that overlaps"
  await page.getByRole("button", { name: "New session" }).click()
  await dialog().waitFor()
  await page.waitForTimeout(250)
  check(
    "New session focuses the title",
    await field("Title").evaluate((el) => el === document.activeElement)
  )
  await field("Title").fill(added.title)
  await field("Start").fill(added.start)
  await duration(`${added.duration} min`)
  const preview = await dialog()
    .getByRole("list", { name: "Overlapping sessions" })
    .getByRole("listitem")
    .evaluateAll((items) =>
      items.map((li) => {
        const [title, rest] = [
          li.firstChild.firstChild.textContent,
          li.lastChild.textContent,
        ]
        return `${title.trim()}|${rest.trim()}`
      })
    )
  check(
    "overlap preview matches the oracle",
    JSON.stringify(preview) === JSON.stringify(expectedPreview),
    { preview, expectedPreview }
  )
  check(
    "end time",
    await dialog().getByText("13:00", { exact: true }).isVisible()
  )
  check("Save is allowed with an overlap", await save().isEnabled())
  await shot("add-preview")
  await save().click()
  await closed()
  schedule = [...schedule, addedSession]
  check(
    "summary after add",
    (await status()) === summaryOf(schedule),
    await status()
  )
  check(
    "focus returns to New session",
    (await focused()).includes("New session"),
    await focused()
  )
  await shot("after-add")

  step = "invalid input"
  await page.getByRole("button", { name: "New session" }).click()
  await dialog().waitFor()
  await field("Title").fill("   ")
  await field("Title").blur()
  check(
    "empty title message",
    await dialog().getByText("Enter a title.").isVisible()
  )
  await field("Title").fill("a".repeat(81))
  check(
    "long title message",
    await dialog()
      .getByText("Keep the title to 80 characters or fewer.")
      .isVisible()
  )
  await field("Title").fill("Valid")
  await field("Start").fill("23:57")
  check(
    "start range message",
    await dialog()
      .getByText("Enter a time as HH:mm, from 00:00 to 23:55.")
      .isVisible()
  )
  await field("Start").fill("09:03")
  check(
    "off-step start message",
    await dialog()
      .getByText("Start on a 5-minute step, such as 09:00 or 09:05.")
      .isVisible()
  )
  await field("Start").fill("9am")
  check(
    "unparseable start message",
    await dialog()
      .getByText("Enter a time as HH:mm, from 00:00 to 23:55.")
      .isVisible()
  )
  await field("Start").fill("09:00")
  await duration("Custom")
  await field("Custom duration (minutes)").fill("42")
  check(
    "duration message",
    await dialog()
      .getByText("Use 5 minutes to 24 hours, in 5-minute steps.")
      .isVisible()
  )
  check("Save disabled while invalid", await save().isDisabled())
  await shot("invalid")
  await page.keyboard.press("Escape")
  await closed()

  step = "edit an Agenda row past midnight"
  await page.getByRole("button", { name: /Panel wrap-up/ }).click()
  await dialog().waitFor()
  check(
    "edit dialog is filled",
    (await field("Title").inputValue()) === "Panel wrap-up" &&
      (await field("Start").inputValue()) === "17:00"
  )
  await field("Start").fill("23:45")
  await duration("60 min")
  const ends =
    (await dialog()
      .getByText(/^00:45/)
      .textContent()) ?? ""
  check("end says next day", /00:45\s*next day/.test(ends), ends)
  await shot("edit-next-day")
  await save().click()
  await closed()
  schedule = schedule.map((s) =>
    s.title === "Panel wrap-up"
      ? { ...s, start: minutes("23:45"), duration: 60 }
      : s
  )
  check(
    "summary after edit",
    (await status()) === summaryOf(schedule),
    await status()
  )
  // At 23:45 it overlaps On-call handoff, so its opener is now the conflict
  // card's Edit button rather than the row that was clicked.
  check(
    "focus returns to the edited session",
    (await focusedSessionId()) === wrapUpId,
    { sessionId: await focusedSessionId(), text: await focused() }
  )

  step = "edits survive switching to Day"
  await viewLink("Day").click()
  await page.getByRole("region", { name: "Day" }).waitFor()
  check(
    "added session is in the Day grid",
    (await page
      .getByRole("region", { name: "Day" })
      .getByRole("listitem", { name: /^Design review, 12:30/ })
      .count()) === 1
  )

  step = "delete from a Day block"
  const victim = schedule.find((s) => s.title.startsWith("Take-home review"))
  await page.getByRole("button", { name: /Take-home review/ }).click()
  await dialog().waitFor()
  check(
    "Day block opens its session",
    (await field("Title").inputValue()) === victim.title
  )
  await dialog().getByRole("button", { name: "Delete" }).click()
  await closed()
  schedule = schedule.filter((s) => s !== victim)
  check(
    "deleted block is gone",
    (await page.getByRole("button", { name: /Take-home review/ }).count()) === 0
  )
  check(
    "summary after delete",
    (await status()) === summaryOf(schedule),
    await status()
  )
  check(
    "focus moves to New session after delete",
    (await focused()).includes("New session"),
    await focused()
  )

  step = "Clear day"
  await page.getByRole("button", { name: "Clear day" }).click()
  check(
    "Day empty state",
    await page
      .getByRole("region", { name: "Day" })
      .getByText("Nothing scheduled")
      .isVisible()
  )
  check(
    "summary when empty",
    (await status()) === "No conflicts",
    await status()
  )
  await shot("day-empty")
  await viewLink("Agenda").click()
  await page
    .getByRole("region", { name: "Agenda" })
    .getByText("Nothing scheduled")
    .waitFor()
  check(
    "Agenda has no list when empty",
    (await page.getByRole("list", { name: "Agenda" }).count()) === 0
  )
  await shot("agenda-empty")
  await page.getByRole("button", { name: "Add the first session" }).click()
  check(
    "empty state opens New session",
    await page.getByRole("dialog", { name: "New session" }).isVisible()
  )
  await page.keyboard.press("Escape")
  await closed()
} catch (error) {
  check(`step "${step}" ran`, false, String(error))
  await page.screenshot({ path: join(outDir, "failure.png") })
}

check("no page errors", errors.length === 0, errors)
writeFileSync(
  join(outDir, "report.json"),
  JSON.stringify({ checks, errors }, null, 2)
)
await browser.close()
const failed = checks.filter((c) => !c.ok)
console.log(
  failed.length === 0
    ? `PASS: ${checks.length} checks`
    : `FAIL: ${failed.length} of ${checks.length} checks`
)
process.exit(failed.length === 0 ? 0 : 1)
