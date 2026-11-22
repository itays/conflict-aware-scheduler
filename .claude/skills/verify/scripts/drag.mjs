#!/usr/bin/env node
// Prove drag-to-move in the Day view: the live label, conflict marks and
// gutter markers before the drop, the drop's summary, Esc (including the
// release after it), 15-minute steps from an off-step start, both clamps
// with auto-scroll, a dragged session never folding into "+N", a plain click
// still opening the editor, and touch (hold to drag, swipe to scroll, tap).
//
//   node drag.mjs <base-url> <artifact-dir>
//
// Expected summaries and gutter markers come from a pairwise oracle over
// src/schedule/sample-day.ts with the dragged start swapped in, never from
// the app's own functions. Writes one .png per step and report.json; exits 1
// on any failed check or page error (a thrown step also writes failure.png).
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { chromium, devices } from "@playwright/test"
import { sampleDay } from "../../../../src/schedule/sample-day.ts"

const [baseUrl, outDir] = process.argv.slice(2)
if (!baseUrl || !outDir) {
  console.error("usage: node drag.mjs <base-url> <artifact-dir>")
  process.exit(2)
}
mkdirSync(outDir, { recursive: true })

// ---- Oracle ---------------------------------------------------------------
const DAY = 1440
const end = (s) => s.start + s.duration
const shared = (a, b) => Math.min(end(a), end(b)) - Math.max(a.start, b.start)
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`
const hhmm = (m) =>
  m === DAY
    ? "24:00"
    : `${String(Math.floor((m % DAY) / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
/** Conflicts as groups joined by overlaps, each with its first and last shared minute. */
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
    const g = groups.get(root(i)) ?? {
      members: new Set(),
      start: DAY * 2,
      end: 0,
    }
    g.members.add(i).add(j)
    g.start = Math.min(g.start, Math.max(schedule[i].start, schedule[j].start))
    g.end = Math.max(g.end, Math.min(end(schedule[i]), end(schedule[j])))
    groups.set(root(i), g)
  }
  return [...groups.values()].sort((a, b) => a.start - b.start)
}
function summaryOf(schedule) {
  const groups = conflictsOf(schedule)
  const sessions = groups.reduce((n, g) => n + g.members.size, 0)
  return groups.length === 0
    ? "No conflicts"
    : `${plural(groups.length, "conflict")} · ${plural(sessions, "session")}`
}
const markersOf = (schedule) =>
  conflictsOf(schedule).map(
    (g) => `Conflict ${hhmm(g.start)} – ${hhmm(Math.min(g.end, DAY))}`
  )
const moved = (schedule, title, start) =>
  schedule.map((s) => (s.title === title ? { ...s, start } : s))
const nameOf = (s) => `${s.title}, ${hhmm(s.start)} – ${hhmm(end(s))}`

const sample = sampleDay()
const byTitle = (title) => sample.find((s) => s.title === title)

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
const shot = (p, name) => p.screenshot({ path: join(outDir, `${name}.png`) })

const handles = (p) => {
  const day = p.getByRole("region", { name: "Day" })
  return {
    day,
    block: (title) =>
      day.getByRole("listitem", { name: new RegExp(`^${title},`) }),
    label: p.locator("[data-drag-label]"),
    status: () => p.getByRole("status").textContent(),
    markers: () =>
      day
        .getByRole("list", { name: "Conflicts" })
        .getByRole("listitem")
        .allTextContents(),
    scroller: day.locator("div.overflow-y-auto"),
  }
}
const { day, block, label, status, markers, scroller } = handles(page)
const load = async () => {
  await page.goto(`${baseUrl}/?view=day`)
  await page.waitForLoadState("networkidle")
}
const centerOf = async (locator) => {
  await locator.scrollIntoViewIfNeeded()
  const box = await locator.boundingBox()
  return [box.x + box.width / 2, box.y + box.height / 2]
}
/** Presses the mouse on a block and moves it `dy` pixels (one per minute). */
const press = async (title, dy) => {
  const [x, y] = await centerOf(block(title))
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y + dy, { steps: 10 })
  return [x, y]
}
/** Holds the pointer at the grid's top or bottom edge until auto-scroll stops moving the label. */
const holdAtEdge = async (x, edge) => {
  const grid = await scroller.boundingBox()
  const y = edge === "top" ? grid.y + 3 : grid.y + grid.height - 3
  let last = ""
  let still = 0
  for (let i = 0; i < 200 && still < 10; i++) {
    await page.mouse.move(x, y + (i % 2))
    await page.waitForTimeout(50)
    const now = await label.textContent()
    still = now === last ? still + 1 : 0
    last = now
  }
  return last
}

let step = "load"
try {
  await load()
  check(
    "one status on the page",
    (await page.getByRole("status").count()) === 1
  )

  step = "drag onto another"
  const standup = byTitle("Standup sync")
  const standupAt0900 = moved(sample, standup.title, standup.start + 30)
  await press(standup.title, 30)
  check("label shows landing start", (await label.textContent()) === "09:00")
  check(
    "block shows its new time mid-drag",
    (await block(standup.title).getAttribute("title")) ===
      nameOf({ ...standup, start: standup.start + 30 })
  )
  check(
    "dragged block is marked In conflict mid-drag",
    (await block(standup.title).getByText("In conflict").count()) === 1
  )
  check(
    "dragged block is hatched mid-drag",
    (await block(standup.title).locator(".bg-hatch").count()) > 0
  )
  check(
    "gutter markers follow the drag",
    JSON.stringify(await markers()) ===
      JSON.stringify(markersOf(standupAt0900)),
    await markers()
  )
  check(
    "summary waits for the drop",
    (await status()) === summaryOf(sample),
    await status()
  )
  await shot(page, "mid-drag")
  await page.mouse.up()
  check(
    "drop commits the overlap",
    (await status()) === summaryOf(standupAt0900),
    await status()
  )
  check(
    "dropped block keeps its new start",
    (await block(standup.title).getAttribute("title")) ===
      nameOf(standupAt0900.find((s) => s.title === standup.title))
  )
  check("drop opens no dialog", (await page.getByRole("dialog").count()) === 0)
  check("label is gone after the drop", (await label.count()) === 0)
  await shot(page, "after-drop")

  step = "Esc cancels"
  await load()
  await press(standup.title, 30)
  await page.keyboard.press("Escape")
  check(
    "Esc returns the block to its start",
    (await block(standup.title).getAttribute("title")) === nameOf(standup)
  )
  check("Esc removes the label", (await label.count()) === 0)
  await page.mouse.up()
  check(
    "Esc leaves the summary unchanged",
    (await status()) === summaryOf(sample),
    await status()
  )
  await press(standup.title, 10)
  await page.keyboard.press("Escape")
  await page.waitForTimeout(200)
  await page.mouse.up()
  check(
    "releasing over the block after Esc opens no dialog",
    (await page.getByRole("dialog").count()) === 0
  )

  step = "steps from an off-step start"
  await page.getByRole("button", { name: "New session" }).click()
  const form = page.getByRole("dialog")
  await form.getByRole("textbox", { name: "Title" }).fill("Odd start")
  await form.getByRole("textbox", { name: "Start" }).fill("07:05")
  await form.getByRole("button", { name: "Save" }).click()
  await form.waitFor({ state: "detached" })
  await press("Odd start", 20)
  check(
    "07:05 dragged 20 minutes lands on 07:20",
    (await label.textContent()) === "07:20",
    await label.textContent()
  )
  await page.mouse.up()
  check(
    "07:05 drop keeps the step",
    (await block("Odd start").getAttribute("title")) ===
      "Odd start, 07:20 – 07:50"
  )

  step = "clamp at the top"
  await load()
  let [x] = await press(standup.title, -10)
  check("stops at 00:00", (await holdAtEdge(x, "top")) === "00:00")
  await shot(page, "clamp-top")
  await page.mouse.up()
  check(
    "drops at 00:00",
    (await block(standup.title).getAttribute("title")) ===
      nameOf({ ...standup, start: 0 })
  )

  step = "clamp at the bottom"
  await load()
  const wrapUp = byTitle("Panel wrap-up")
  ;[x] = await press(wrapUp.title, 10)
  check("stops at 23:55", (await holdAtEdge(x, "bottom")) === "23:55")
  await shot(page, "clamp-bottom")
  await page.mouse.up()
  const wrapUpLate = moved(sample, wrapUp.title, 1435)
  check(
    "drops at 23:55 and runs past midnight",
    (await block(wrapUp.title).textContent()).endsWith("continues tomorrow"),
    await block(wrapUp.title).textContent()
  )
  check(
    "late drop's summary",
    (await status()) === summaryOf(wrapUpLate),
    await status()
  )

  step = "dragged session stays out of +N"
  await load()
  const lunch = byTitle("Lunch with candidate")
  await press(lunch.title, 10 * 60 + 45 - lunch.start)
  check(
    "dragged session stays visible in a fourth lane",
    (await block(lunch.title).getAttribute("title")) ===
      nameOf({ ...lunch, start: 10 * 60 + 45 })
  )
  await shot(page, "fourth-lane")
  await page.mouse.up()
  check(
    "after the drop it folds into +N",
    (await block(lunch.title).count()) === 0 &&
      (await day.getByRole("link", { name: /^\+1 more session/ }).count()) === 1
  )
  check(
    "fold drop's summary",
    (await status()) === summaryOf(moved(sample, lunch.title, 10 * 60 + 45)),
    await status()
  )

  step = "click without movement"
  await load()
  await block("Hiring sync").getByRole("button").click()
  check(
    "click opens the editor",
    await page.getByRole("dialog", { name: "Edit session" }).isVisible()
  )
} catch (error) {
  check(`step "${step}" ran`, false, String(error))
  await page.screenshot({ path: join(outDir, "failure.png") })
}

// ---- Touch ----------------------------------------------------------------
const phone = await browser.newContext({ ...devices["Pixel 7"] })
const tp = await phone.newPage()
tp.on("pageerror", (error) => errors.push(String(error)))
const cdp = await phone.newCDPSession(tp)
const touch = (type, tx, ty) =>
  cdp.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: type === "touchEnd" ? [] : [{ x: tx, y: ty }],
  })
const t = handles(tp)
const tload = async () => {
  await tp.goto(`${baseUrl}/?view=day`)
  await tp.waitForLoadState("networkidle")
}
const tcenter = async (title) => {
  const box = await t.block(title).boundingBox()
  return [box.x + box.width / 2, box.y + box.height / 2]
}
try {
  step = "touch hold and drag"
  await tload()
  const standup = byTitle("Standup sync")
  let [x, y] = await tcenter(standup.title)
  await touch("touchStart", x, y)
  await tp.waitForTimeout(400)
  for (let i = 1; i <= 10; i++) {
    await touch("touchMove", x, y + 3 * i)
    await tp.waitForTimeout(16)
  }
  check("touch label", (await t.label.textContent()) === "09:00")
  await tp.screenshot({ path: join(outDir, "touch-drag.png") })
  await touch("touchEnd")
  check(
    "touch drop's summary",
    (await t.status()) ===
      summaryOf(moved(sample, standup.title, standup.start + 30)),
    await t.status()
  )
  check(
    "touch drop opens no dialog",
    (await tp.getByRole("dialog").count()) === 0
  )

  step = "touch swipe scrolls"
  await tload()
  const phoneScreen = byTitle("Phone screen — Maya Cohen")
  ;[x, y] = await tcenter(phoneScreen.title)
  const before = await t.scroller.evaluate((e) => e.scrollTop)
  await touch("touchStart", x, y)
  for (let i = 1; i <= 10; i++) {
    await touch("touchMove", x, y - 15 * i)
    await tp.waitForTimeout(16)
  }
  await touch("touchEnd")
  await tp.waitForTimeout(300)
  const after = await t.scroller.evaluate((e) => e.scrollTop)
  check("a quick swipe scrolls the grid", after > before, { before, after })
  check(
    "a quick swipe moves nothing",
    (await t.block(phoneScreen.title).getAttribute("title")) ===
      nameOf(phoneScreen) && (await t.label.count()) === 0
  )

  step = "tap"
  await tload()
  await t.block("Hiring sync").getByRole("button").tap()
  check(
    "tap opens the editor",
    await tp.getByRole("dialog", { name: "Edit session" }).isVisible()
  )
} catch (error) {
  check(`step "${step}" ran`, false, String(error))
  await tp.screenshot({ path: join(outDir, "failure-touch.png") })
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
