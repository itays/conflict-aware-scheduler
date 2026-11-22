#!/usr/bin/env node
// Prove resolving conflicts from the Agenda: each card session's "Move to
// next free slot" target, moving a session (summary, card, focus), "Show in
// Day view" with its highlight and "Clear highlight", the header summary
// opening the Agenda, the Day view's "+N" opening the Agenda filtered to its
// conflict with "Show all", a filtered conflict being resolved, and the
// disabled "No free slot today".
//
//   node conflict-resolution.mjs <base-url> <artifact-dir>
//
// Expected values come from a brute-force oracle over
// src/schedule/sample-day.ts plus each change this script makes: conflicts by
// pairwise union-find, and the next free start by trying every 5-minute
// start from the session's own up to 23:55. It never uses the app's
// functions. Writes one .png per step and report.json; exits 1 on any failed
// check or page error (a thrown step also writes failure.png).
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { chromium } from "@playwright/test"
import { sampleDay } from "../../../../src/schedule/sample-day.ts"

const [baseUrl, outDir] = process.argv.slice(2)
if (!baseUrl || !outDir) {
  console.error("usage: node conflict-resolution.mjs <base-url> <artifact-dir>")
  process.exit(2)
}
mkdirSync(outDir, { recursive: true })

// ---- Oracle ---------------------------------------------------------------
const LAST_START = 23 * 60 + 55
const end = (s) => s.start + s.duration
const shared = (a, b) => Math.min(end(a), end(b)) - Math.max(a.start, b.start)
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`
const pad = (n) => String(n).padStart(2, "0")
const hhmm = (m) =>
  m === 1440 ? "24:00" : `${pad(Math.floor((m % 1440) / 60))}:${pad(m % 60)}`
const range = (start, stop) => `${hhmm(start)} – ${hhmm(stop)}`

/** Conflicts in start order, each with its sessions and card name. */
function conflictsOf(schedule) {
  const parent = schedule.map((_, i) => i)
  const root = (i) => (parent[i] === i ? i : root(parent[i]))
  const pairs = []
  for (let i = 0; i < schedule.length; i++) {
    for (let j = i + 1; j < schedule.length; j++) {
      if (shared(schedule[i], schedule[j]) <= 0) continue
      parent[root(i)] = root(j)
      pairs.push([i, j])
    }
  }
  const groups = new Map()
  for (const [i, j] of pairs) {
    const group = groups.get(root(i)) ?? { members: new Set(), pairs: [] }
    group.members.add(i).add(j)
    group.pairs.push([schedule[i], schedule[j]])
    groups.set(root(i), group)
  }
  return [...groups.values()]
    .map(({ members, pairs }) => {
      const sessions = [...members].map((i) => schedule[i])
      const first = Math.min(
        ...pairs.map(([a, b]) => Math.max(a.start, b.start))
      )
      const last = Math.max(...pairs.map(([a, b]) => Math.min(end(a), end(b))))
      return {
        sessions,
        titles: sessions.map((s) => s.title).sort(),
        start: Math.min(...sessions.map((s) => s.start)),
        name: `${sessions.length} sessions overlap ${range(first, last)}`,
        span: range(first, last),
      }
    })
    .sort((a, b) => a.start - b.start)
}

function summaryOf(schedule) {
  const conflicts = conflictsOf(schedule)
  const sessions = conflicts.reduce((n, c) => n + c.sessions.length, 0)
  return conflicts.length === 0
    ? "No conflicts"
    : `${plural(conflicts.length, "conflict")} · ${plural(sessions, "session")}`
}

/** Earliest 5-minute start at or after its own that overlaps nothing else. */
function nextFree(schedule, session) {
  for (let start = session.start; start <= LAST_START; start += 5) {
    const moved = { ...session, start }
    if (schedule.every((o) => o.id === session.id || shared(o, moved) <= 0))
      return start
  }
  return undefined
}

const moveLabel = (schedule, session) => {
  const start = nextFree(schedule, session)
  return start === undefined
    ? "No free slot today"
    : `Move to next free slot ${range(start, start + session.duration)}`
}

const moved = (schedule, session) =>
  schedule.map((s) =>
    s.id === session.id ? { ...s, start: nextFree(schedule, s) } : s
  )

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
const shot = async (name) => {
  await page.waitForTimeout(250)
  await page.screenshot({ path: join(outDir, `${name}.png`) })
}
const open = async (search) => {
  await page.goto(`${baseUrl}/${search}`)
  await page.waitForLoadState("networkidle")
}
const status = async () => (await page.getByRole("status").textContent()).trim()
const search = () => new URL(page.url()).searchParams
const cards = () => page.getByRole("region", { name: /sessions overlap/ })
const cardNames = async () =>
  (
    await cards().evaluateAll((els) =>
      els.map((el) =>
        document
          .getElementById(el.getAttribute("aria-labelledby"))
          .textContent.trim()
      )
    )
  ).map((name) => name.replace(/\s+/g, " "))
const card = (name) => page.getByRole("region", { name, exact: true })
const cardRow = (cardName, title) =>
  card(cardName)
    .getByRole("list", { name: "Sessions" })
    .getByRole("listitem")
    .filter({ hasText: title })
const focusedSessionId = () =>
  page.evaluate(() => document.activeElement?.dataset.sessionId ?? "")
const focusedText = () =>
  page.evaluate(() => document.activeElement?.textContent?.trim() ?? "")

/** Every card session's move button against the oracle. */
async function checkMoveLabels(schedule, label) {
  const mismatches = []
  let checked = 0
  for (const conflict of conflictsOf(schedule)) {
    for (const session of conflict.sessions) {
      checked++
      const expected = moveLabel(schedule, session)
      const button = cardRow(conflict.name, session.title).getByRole("button", {
        name: expected,
        exact: true,
      })
      const found = await button.count()
      const disabled = found === 1 && (await button.isDisabled())
      if (found !== 1 || disabled !== expected.startsWith("No free slot"))
        mismatches.push({ title: session.title, expected, found, disabled })
    }
  }
  check(label, checked > 0 && mismatches.length === 0, { checked, mismatches })
}

async function addSession(title, start, duration) {
  await page.getByRole("button", { name: "New session" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("textbox", { name: "Title" }).fill(title)
  await dialog.getByRole("textbox", { name: "Start" }).fill(start)
  if (duration !== 30) {
    await dialog
      .locator("label")
      .filter({ hasText: /^Custom$/ })
      .click()
    await dialog
      .getByRole("textbox", { name: "Custom duration (minutes)" })
      .fill(String(duration))
  }
  await dialog.getByRole("button", { name: "Save" }).click()
  await dialog.waitFor({ state: "detached" })
}

let step = "start"
try {
  let schedule = sampleDay()
  const [first, second] = conflictsOf(schedule)

  step = "header summary opens the Agenda"
  await open("?view=day")
  const summaryLink = page.getByRole("status").getByRole("link")
  check("summary is a link", (await summaryLink.count()) === 1, await status())
  await summaryLink.click()
  await page.waitForURL(/view=agenda/)
  await page.getByRole("list", { name: "Agenda" }).waitFor()
  check(
    "summary link opens the unfiltered Agenda",
    new URL(page.url()).search === "?view=agenda",
    new URL(page.url()).search
  )
  check(
    "Agenda shows every card",
    (await cards().count()) === conflictsOf(schedule).length
  )

  step = "move targets on the sample day"
  await checkMoveLabels(schedule, "move targets match the oracle")
  await shot("agenda")

  step = "Show in Day view"
  await card(first.name).getByRole("link", { name: "Show in Day view" }).click()
  await page.waitForURL(/view=day/)
  await page.getByRole("region", { name: "Day" }).waitFor()
  const ids = (search().get("conflict") ?? "").split(",").sort()
  check(
    "Day link carries the conflict's sessions",
    search().get("view") === "day" &&
      JSON.stringify(ids) ===
        JSON.stringify(first.sessions.map((s) => s.id).sort()),
    page.url()
  )
  const highlighted = async () =>
    (
      await page
        .getByRole("region", { name: "Day" })
        .getByRole("list", { name: "Sessions" })
        .getByRole("listitem")
        .evaluateAll((items) =>
          items
            .filter((li) => li.textContent.includes("Highlighted"))
            .map((li) => li.getAttribute("title").split(", ")[0])
        )
    ).sort()
  check(
    "exactly the conflict's sessions are highlighted",
    JSON.stringify(await highlighted()) === JSON.stringify(first.titles),
    await highlighted()
  )
  check(
    "the bar names the highlighted conflict",
    await page
      .getByText(`Highlighting the conflict at ${first.span}.`)
      .isVisible()
  )
  await shot("day-highlight")
  await page.getByRole("link", { name: "Clear highlight" }).click()
  await page.waitForURL((url) => !url.searchParams.has("conflict"))
  check(
    "Clear highlight drops the conflict",
    new URL(page.url()).search === "?view=day" &&
      (await highlighted()).length === 0,
    new URL(page.url()).search
  )

  step = "move a session out of a two-session conflict"
  await open("?view=agenda")
  const debrief = second.sessions.at(-1)
  await cardRow(second.name, debrief.title)
    .getByRole("button", { name: moveLabel(schedule, debrief), exact: true })
    .click()
  schedule = moved(schedule, debrief)
  check(
    "summary after the move",
    (await status()) === summaryOf(schedule),
    await status()
  )
  check(
    "the resolved card is gone",
    (await card(second.name).count()) === 0,
    await cardNames()
  )
  check(
    "the moved session overlaps nothing",
    conflictsOf(schedule).every((c) => !c.titles.includes(debrief.title)) &&
      (await cards().filter({ hasText: debrief.title }).count()) === 0
  )
  check(
    "focus follows the moved session",
    (await focusedSessionId()) === debrief.id,
    { sessionId: await focusedSessionId(), text: await focusedText() }
  )
  await shot("after-move")

  step = "resolve a filtered conflict"
  schedule = sampleDay()
  await open(
    `?view=agenda&conflict=${first.sessions.map((s) => s.id).join(",")}`
  )
  check(
    "the filter shows only its conflict",
    JSON.stringify(await cardNames()) === JSON.stringify([first.name]),
    await cardNames()
  )
  check(
    "the bar says what is shown",
    await page
      .getByText(`Showing only the conflict at ${first.span}.`)
      .isVisible()
  )
  await shot("filtered")
  // Move sessions out one at a time, always the one the oracle lists first
  // that can move, until the conflict is gone.
  for (let guard = 0; guard < 5; guard++) {
    const remaining = conflictsOf(schedule).find((c) =>
      c.sessions.some((s) => first.sessions.some((f) => f.id === s.id))
    )
    if (!remaining) break
    const session = remaining.sessions.find(
      (s) => nextFree(schedule, s) !== undefined
    )
    await cardRow(remaining.name, session.title)
      .getByRole("button", { name: moveLabel(schedule, session), exact: true })
      .click()
    schedule = moved(schedule, session)
    const still = conflictsOf(schedule).filter((c) =>
      c.sessions.some((s) => first.sessions.some((f) => f.id === s.id))
    )
    check(
      `after moving ${session.title}, the filter shows ${still.length} card(s)`,
      JSON.stringify(await cardNames()) ===
        JSON.stringify(still.map((c) => c.name)),
      await cardNames()
    )
    check(
      `focus goes to Show all after moving ${session.title}`,
      (await focusedText()) === "Show all",
      await focusedText()
    )
  }
  check(
    "the bar says the conflict is resolved",
    await page.getByText("This conflict is resolved.").isVisible()
  )
  await shot("filtered-resolved")
  await page.getByRole("link", { name: "Show all" }).click()
  await page.waitForURL((url) => !url.searchParams.has("conflict"))
  await page.getByRole("list", { name: "Agenda" }).waitFor()
  check(
    "Show all brings back every card",
    JSON.stringify(await cardNames()) ===
      JSON.stringify(conflictsOf(schedule).map((c) => c.name)),
    await cardNames()
  )

  step = "+N opens the Agenda filtered to its conflict"
  schedule = sampleDay()
  await open("?view=day")
  await addSession("Extra hold", "10:45", 30)
  schedule = [
    ...schedule,
    { id: "extra", title: "Extra hold", start: 645, duration: 30 },
  ]
  const crowded = conflictsOf(schedule).find((c) =>
    c.titles.includes("Extra hold")
  )
  const more = page
    .getByRole("region", { name: "Day" })
    .getByRole("link", { name: /^\+\d+ more session/ })
  await more.click()
  await page.waitForURL(/view=agenda/)
  await page.getByRole("list", { name: "Agenda" }).waitFor()
  check("+N sets a conflict filter", search().has("conflict"), page.url())
  check(
    "+N shows only its conflict",
    JSON.stringify(await cardNames()) === JSON.stringify([crowded.name]),
    await cardNames()
  )
  await shot("overflow-filtered")
  await page.getByRole("link", { name: "Show all" }).click()
  await page.waitForURL((url) => !url.searchParams.has("conflict"))
  check(
    "Show all clears the +N filter",
    JSON.stringify(await cardNames()) ===
      JSON.stringify(conflictsOf(schedule).map((c) => c.name)),
    await cardNames()
  )

  step = "no free slot today"
  schedule = sampleDay()
  await open("?view=agenda")
  await addSession("All day", "00:00", 1440)
  schedule = [
    ...schedule,
    { id: "all-day", title: "All day", start: 0, duration: 1440 },
  ]
  await checkMoveLabels(schedule, "move targets with an all-day session")
  await shot("no-free-slot")
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
