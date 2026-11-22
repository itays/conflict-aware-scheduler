# Day view

The Day view draws the schedule on a vertical 24-hour grid, one pixel per minute, in the style of design board A. Each session is a block with its title and time range. Overlapping sessions sit side by side in lanes. Sessions in a conflict turn red, carry a warning icon and an `In conflict` label, and only the minutes they overlap another session are hatched. A red marker in the hour gutter spans each conflict. Past three lanes, the extra sessions fold into a `+N` link. A session running past midnight stops at the bottom of the grid with `continues tomorrow`. The grid scrolls on its own and opens just above the first session.

## Sub-features

- `day-hours`: the gutter labels every hour `00:00` to `23:00`.
- `day-blocks`: one block per session, named `<title>, HH:mm – HH:mm` (also its hover tooltip, which keeps short sessions readable).
- `day-lanes`: overlapping sessions split the width into side-by-side lanes and never cover each other. Back-to-back sessions stay full width and blue.
- `day-conflict-marks`: conflict blocks are red with a warning icon and `In conflict`, and hatching covers only their overlapping minutes.
- `day-gutter-markers`: the `Conflicts` list holds one `Conflict HH:mm – HH:mm` marker per conflict.
- `day-overflow`: with more than three lanes, the extra sessions fold into `+N` (accessible name `+N more sessions`), which opens the Agenda.
- `day-midnight`: `On-call handoff` reads `23:30 – 00:30` with `continues tomorrow` and a dashed bottom edge.
- `day-opening-scroll`: after hydration the grid opens at 08:00, 30 minutes above the 08:30 `Standup sync`.

## How to get to it (user POV)

- Open `/` or `/?view=day`.
- Click `Day` in the header's `View` switch.

## Driving it with Playwright

Preconditions:

- Baseline preconditions from the README.

- **Capture the grid.** Run `node .claude/skills/verify/scripts/snap.mjs "$URL/?view=day" "$ARTIFACTS/day-view" day`. It exits 0. In `day.aria.yaml`:
  - `region "Day"` holds `list "Conflicts"` and `list "Sessions"`, which has 11 `listitem`s, one per sample session.
  - The five items `System design — Omer Levi`, `Hiring sync`, `Room 4B hold`, `Culture interview` and `Recruiter debrief` start with `In conflict`. `Standup sync` and `Phone screen — Maya Cohen` (back-to-back) do not.
  - `listitem "On-call handoff, 23:30 – 00:30"` ends with `continues tomorrow`.
- **Look at it.** `day.png` opens at `08:00`. System design, Hiring sync and Room 4B hold sit in three side-by-side lanes, and Culture interview and Recruiter debrief in two. Only the overlapping minutes are hatched, and red gutter bars sit at 10:30–11:15 and 14:00–14:15.
- **Conflict marks against the oracle.** Run the flagship proof (`conflict-summary.md`). It checks the `In conflict` blocks and the gutter markers against its own pairwise oracle.
- **Past midnight.** The full-page screenshot does not scroll the grid, so scroll the block into view:

  ```sh
  node --input-type=module -e '
  import { chromium } from "@playwright/test"
  const [url, out] = process.argv.slice(1)
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } })
  await p.goto(url); await p.waitForLoadState("networkidle")
  const block = p.getByRole("region", { name: "Day" }).getByRole("listitem", { name: /^On-call handoff/ })
  await block.scrollIntoViewIfNeeded()
  await p.screenshot({ path: out })
  console.log("block text:", (await block.textContent()).trim())
  await b.close()' "$URL/?view=day" "$ARTIFACTS/day-view/midnight.png"
  ```

  It prints `block text: On-call handoff23:30 – 00:30continues tomorrow`, and `midnight.png` shows the block ending at the grid's bottom edge with `↓ continues tomorrow`.
- **Dark theme.** Run `node .claude/skills/verify/scripts/snap.mjs "$URL/?view=day" "$ARTIFACTS/day-view" day-dark dark`. In `day-dark.png`, the blue session blocks and the red, hatched conflict blocks are readable.
- **Overflow (`+N`).** Not reachable live with the sample day: its busiest moment needs three lanes, and the app cannot add sessions until issue #4 adds editing. The component test `folds the sessions past the third lane into +N` in `src/components/day-view.test.tsx` covers it. Once sessions can be added, add a fourth session at 10:45 and click `link "+1 more session"`.

## Gotchas

- Before hydration the server-rendered grid sits at `00:00`. It jumps to `08:00` when React hydrates. `snap.mjs` waits for `networkidle`, so its screenshots show the hydrated state. A hand-written script must do the same.
- Session blocks are absolutely positioned. Read their order from the ARIA snapshot (start order), not from screen position.
- The Agenda's conflict cards also hold lists named `Sessions`. Scope the Day list as `region "Day"` → `list "Sessions"`.
- A session ending exactly at `24:00` does not get `continues tomorrow`. Only one ending after midnight does.
