# Today's date

The page shows today's date above whichever view is showing, so the Day view and the Agenda open the same way. It is the short weekday over the day of the month in a filled circle, beside the full date (`Sunday, November 22`). The date is the viewer's own, read from the browser's clock, and it rolls over at the viewer's midnight in a tab left open.

## Sub-features

- `today-date`: `main` holds a `<time datetime="YYYY-MM-DD">` with the viewer's local date. Its visible text is the short weekday and the day of the month, hidden from screen readers, then the full date.
- `today-both-views`: the date sits above the view, outside `region "Day"` and `region "Agenda"`, and stays in place when the `View` switch changes the view.
- `today-client-only`: the server leaves the date out of its HTML, and the date appears when React hydrates. The space it takes is reserved meanwhile, so nothing below it moves.
- `today-midnight`: at the viewer's local midnight the date changes to the next day without a reload.

## How to get to it (user POV)

- Open `/`, `/?view=day` or `/?view=agenda`. The date is at the top of the main area.

## Driving it with Playwright

Preconditions:

- Baseline preconditions from the README.

- **Both views on a fixed clock.** Run:

  ```sh
  node --input-type=module -e '
  import { chromium } from "@playwright/test"
  const [url] = process.argv.slice(1)
  const b = await chromium.launch(); const p = await b.newPage()
  const errors = []; p.on("pageerror", (e) => errors.push(String(e)))
  await p.clock.setFixedTime(new Date(2026, 10, 22, 9, 0))
  const date = p.getByRole("main").locator("time")
  const read = async () => `${await date.getAttribute("datetime")} ${(await date.textContent()).trim()}`
  await p.goto(url + "/?view=day"); await p.waitForLoadState("networkidle")
  console.log("day:", await read())
  await p.getByRole("navigation", { name: "View" }).getByRole("link", { name: "Agenda" }).click()
  await p.getByRole("list", { name: "Agenda" }).waitFor()
  console.log("after switch:", await read())
  await p.goto(url + "/?view=agenda"); await p.waitForLoadState("networkidle")
  console.log("agenda:", await read())
  console.log("in server HTML:", (await (await p.request.get(url + "/?view=agenda")).text()).includes("<time"), "errors:", JSON.stringify(errors))
  await b.close()' "$URL"
  ```

  It prints `2026-11-22 Sun22Sunday, November 22` for `day`, `after switch` and `agenda`, then `in server HTML: false errors: []`.
- **Midnight.** The unit test `today's date › rolls over to the next day at midnight` in `src/components/scheduler-page.test.tsx` covers the rollover with fake timers. In the browser, call `page.clock.install({ time: new Date(2026, 10, 22, 23, 59, 30) })` before `goto`, then `page.clock.runFor(60_000)`: the date reads `Monday, November 23`.

## Gotchas

- The expected date comes from the browser's clock, not from `sample-day.ts`. Fix the clock (`page.clock.setFixedTime` or `page.clock.install`) before `goto` to compare against a known value.
- The server's clock is in UTC and could name another day than the viewer's, so the server never renders the date. Read it only after `networkidle`. A `curl` of the page has no `<time>`.
- Scope the date to `getByRole("main")`. It is outside both views' regions, so `region "Day"` → `time` finds nothing.
