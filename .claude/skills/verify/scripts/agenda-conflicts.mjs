#!/usr/bin/env node
// Prove the conflict summary, the Day view's conflict marks and the Agenda
// conflict cards match the overlapping sessions in src/schedule/sample-day.ts.
//
//   node agenda-conflicts.mjs <base-url> <artifact-dir>
//
// The expected values come from a brute-force oracle written here (every pair
// checked, groups joined with union-find), not from the app's own
// findConflicts, so the app cannot agree with itself by construction.
// Writes day.png, day.aria.yaml, agenda.png, agenda.aria.yaml and
// report.json; exits 1 on any mismatch, page error or failed step (a failed
// step also writes failure.png and puts the error in report.json).
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { chromium } from "@playwright/test"
import { sampleDay } from "../../../../src/schedule/sample-day.ts"

const [baseUrl, outDir] = process.argv.slice(2)
if (!baseUrl || !outDir) {
  console.error("usage: node agenda-conflicts.mjs <base-url> <artifact-dir>")
  process.exit(2)
}
mkdirSync(outDir, { recursive: true })

// ---- Oracle ---------------------------------------------------------------
const sessions = sampleDay()
const end = (s) => s.start + s.duration
const hhmm = (m) =>
  m === 1440
    ? "24:00"
    : `${String(Math.floor((m % 1440) / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`

const overlaps = []
const parent = sessions.map((_, i) => i)
const root = (i) => {
  while (parent[i] !== i) i = parent[i]
  return i
}
sessions.forEach((a, i) => {
  sessions.forEach((b, j) => {
    if (j <= i || !(a.start < end(b) && b.start < end(a))) return
    const start = Math.max(a.start, b.start)
    const stop = Math.min(end(a), end(b))
    overlaps.push({ i, j, start, end: stop, minutes: stop - start })
    parent[root(i)] = root(j)
  })
})

const groups = new Map()
for (const o of overlaps) {
  const key = root(o.i)
  const group = groups.get(key) ?? { members: new Set(), overlaps: [] }
  group.members.add(o.i).add(o.j)
  group.overlaps.push(o)
  groups.set(key, group)
}
const pairKey = (x, y) => [x, y].sort().join(" × ")
const expectedCards = [...groups.values()].map((g) => ({
  name: `${g.members.size} sessions overlap ${hhmm(Math.min(...g.overlaps.map((o) => o.start)))} – ${hhmm(Math.max(...g.overlaps.map((o) => o.end)))}`,
  titles: [...g.members].map((i) => sessions[i].title).sort(),
  overlaps: Object.fromEntries(
    g.overlaps.map((o) => [
      pairKey(sessions[o.i].title, sessions[o.j].title),
      o.minutes,
    ])
  ),
}))
const inConflict = new Set([...groups.values()].flatMap((g) => [...g.members]))
const expected = {
  summary:
    groups.size === 0
      ? "No conflicts"
      : `${plural(groups.size, "conflict")} · ${plural(inConflict.size, "session")}`,
  cards: expectedCards.sort((a, b) => a.name.localeCompare(b.name)),
  calmTitles: sessions.filter((_, i) => !inConflict.has(i)).map((s) => s.title),
  dayConflictTitles: [...inConflict].map((i) => sessions[i].title).sort(),
  // The Day grid ends at 24:00, so its markers stop there.
  dayMarkers: [...groups.values()]
    .map(
      (g) =>
        `Conflict ${hhmm(Math.min(...g.overlaps.map((o) => o.start)))} – ${hhmm(Math.min(1440, Math.max(...g.overlaps.map((o) => o.end))))}`
    )
    .sort(),
}

// ---- Drive the app as a user ----------------------------------------------
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const pageErrors = []
page.on("pageerror", (error) => pageErrors.push(String(error)))

let summaryOnEntry
let summaryOnAgenda
let dayBlocks = []
let dayMarkers = []
const observedCards = []
let cardText = ""
let agendaText = ""
let step = "open /"
try {
  await page.goto(baseUrl)
  summaryOnEntry = (await page.getByRole("status").textContent()).trim()

  step = "read the Day view"
  const daySessions = page
    .getByRole("region", { name: "Day" })
    .getByRole("list", { name: "Sessions" })
  await daySessions.waitFor()
  dayBlocks = await daySessions.getByRole("listitem").allTextContents()
  dayMarkers = (
    await page
      .getByRole("list", { name: "Conflicts" })
      .getByRole("listitem")
      .allTextContents()
  )
    .map((text) => text.trim())
    .sort()
  await page.screenshot({ path: join(outDir, "day.png") })
  writeFileSync(
    join(outDir, "day.aria.yaml"),
    await page.locator("body").ariaSnapshot()
  )

  step = "switch to the Agenda"
  await page
    .getByRole("navigation", { name: "View" })
    .getByRole("link", { name: "Agenda" })
    .click()
  await page.waitForURL(/[?&]view=agenda/)
  const agenda = page.getByRole("list", { name: "Agenda" })
  await agenda.waitFor()
  summaryOnAgenda = (await page.getByRole("status").textContent()).trim()

  step = "read the conflict cards"
  for (const card of await page
    .getByRole("region", { name: /sessions overlap/ })
    .all()) {
    const name = (await card.getByRole("heading").first().textContent())
      .replace(/\s+/g, " ")
      .trim()
    const rows = await card
      .getByRole("list", { name: "Sessions" })
      .getByRole("listitem")
      .allTextContents()
    const titles = sessions
      .map((s) => s.title)
      .filter((t) => rows.some((row) => row.includes(t)))
      .sort()
    const overlapItems = {}
    for (const item of await card
      .getByRole("list", { name: "Overlaps" })
      .getByRole("listitem")
      .all()) {
      const [pair, minutes] = await item.locator("span").allTextContents()
      const [a, b] = pair.split(" × ")
      overlapItems[pairKey(a, b)] = Number.parseInt(minutes, 10)
    }
    observedCards.push({
      name,
      titles,
      rowCount: rows.length,
      overlaps: overlapItems,
    })
  }
  observedCards.sort((a, b) => a.name.localeCompare(b.name))

  cardText = (
    await page
      .getByRole("region", { name: /sessions overlap/ })
      .allTextContents()
  ).join("\n")
  agendaText = await agenda.textContent()

  await page.screenshot({ path: join(outDir, "agenda.png"), fullPage: true })
  writeFileSync(
    join(outDir, "agenda.aria.yaml"),
    await page.locator("body").ariaSnapshot()
  )
} catch (error) {
  await page
    .screenshot({ path: join(outDir, "failure.png"), fullPage: true })
    .catch(() => {})
  await browser.close()
  const report = {
    baseUrl,
    pass: false,
    failedStep: step,
    error: String(error),
    expected,
    observed: { summaryOnEntry, summaryOnAgenda, pageErrors },
  }
  writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2))
  console.log(
    `FAIL: could not ${step}, see ${join(outDir, "report.json")} and failure.png`
  )
  process.exit(1)
}
await browser.close()

const dayConflictTitles = sessions
  .map((s) => s.title)
  .filter((t) =>
    dayBlocks.some(
      (block) => block.includes(t) && block.includes("In conflict")
    )
  )
  .sort()

// ---- Compare ----------------------------------------------------------------
const mismatches = []
const expectEqual = (label, actual, wanted) => {
  if (JSON.stringify(actual) !== JSON.stringify(wanted))
    mismatches.push({ label, actual, expected: wanted })
}
expectEqual("header summary on entry (/)", summaryOnEntry, expected.summary)
expectEqual("header summary on Agenda", summaryOnAgenda, expected.summary)
expectEqual("Day view session blocks", dayBlocks.length, sessions.length)
expectEqual(
  "Day view sessions marked In conflict",
  dayConflictTitles,
  expected.dayConflictTitles
)
expectEqual("Day view gutter markers", dayMarkers, expected.dayMarkers)
expectEqual(
  "conflict cards",
  observedCards.map(({ rowCount, ...card }) => card),
  expected.cards
)
for (const card of observedCards)
  expectEqual(
    `session rows in "${card.name}"`,
    card.rowCount,
    card.titles.length
  )
for (const title of expected.calmTitles) {
  if (!agendaText.includes(title))
    mismatches.push({ label: `session "${title}" missing from the Agenda` })
  if (cardText.includes(title))
    mismatches.push({
      label: `session "${title}" wrongly shown in a conflict card`,
    })
}
expectEqual("page errors", pageErrors, [])

const report = {
  baseUrl,
  pass: mismatches.length === 0,
  expected,
  observed: {
    summaryOnEntry,
    summaryOnAgenda,
    dayConflictTitles,
    dayMarkers,
    cards: observedCards,
    pageErrors,
  },
  mismatches,
}
writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2))
console.log(
  report.pass
    ? `PASS: "${expected.summary}" with ${expected.cards.length} matching conflict cards and Day view marks`
    : `FAIL: ${mismatches.length} mismatch(es), see ${join(outDir, "report.json")}`
)
process.exit(report.pass ? 0 : 1)
