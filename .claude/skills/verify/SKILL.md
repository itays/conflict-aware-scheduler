---
name: verify
description: Drive the Conflict-Aware Scheduler web app (TanStack Start, single page at `/`) in a real Chromium browser and capture proof of what a user sees. Use to confirm a UI change works in the running app, to prove the header conflict summary, the Day view's conflict marks and the Agenda conflict cards match the sample day, to prove adding, editing, deleting and clearing sessions through the session dialog, to prove resolving conflicts from the Agenda's cards (move to next free slot, Show in Day view, the conflict filter), to prove dragging sessions in the Day view by mouse, touch or keyboard and its screen reader announcements, or whenever a change touches the schedule module, the Day view, the Agenda, the session dialog, the header or routing and unit tests alone are not proof.
---

# Verify the Conflict-Aware Scheduler

The app is one web page. Users touch the header (title, conflict summary, Day/Agenda switch, `Clear day`, `New session`, theme toggle) and the main area, which shows the Day view's time grid (`?view=day`, the default) or the Agenda (`?view=agenda`). An optional `conflict` parameter (comma-joined session ids) filters the Agenda to the conflicts holding any of those sessions, or highlights them in the Day view. Clicking a Day block, an Agenda row, a conflict card's `Edit`, or `New session` opens one shared session dialog. Conflict cards also move a session to its next free slot, and dragging a Day block up or down, by pointer or with Space and the arrow keys, moves its start. The schedule lives in memory and every page load starts from the sample day in `src/schedule/sample-day.ts`. Edits last until the next load, so there is no data directory and no seeding step: a reload is a reset.

The harness is Playwright's Chromium, driven by Node scripts in `scripts/`. Both are already installed by `bun install`. Every helper is run from the repo root.

Before driving, read [`features/README.md`](features/README.md) and the feature file for what you are proving.

## Launch

```sh
.claude/skills/verify/scripts/verify.sh launch
```

This starts the Vite dev server for the working tree on a free port, in its own process group. It prints three lines. Keep them:

```
RUN_ID=20261122-123513-15461
URL=http://127.0.0.1:64876
ARTIFACTS=/…/conflict-aware-scheduler/verify-artifacts/20261122-123513-15461
```

The app is ready when `launch` returns 0. Launch waits until `GET /` serves a page titled `Scheduler`, which is usable: the page renders on the server with the sample day. A nonzero exit prints the server log. Run `cleanup` with the printed RUN_ID before retrying.

Each launch is an independent instance, so parallel runs are safe. Do not drive a server you did not launch (for example the user's `bun run dev` on port 3000).

The dev server serves uncommitted edits. To prove the production build, run the Playwright smoke test instead (`bun run test:e2e:smoke`). It builds and serves `dist/`, which is shared, so never run two of those at once.

## Doctor

```sh
.claude/skills/verify/scripts/verify.sh doctor "$RUN_ID"
```

Read-only. It checks three things: the server process is alive, the port is held by our process group, and `/` serves the Scheduler page. It also prints the commit the instance was launched from (with `dirty` if the tree had edits), the URL and the server log path. Run it first whenever anything looks off. A `FAIL` line means the instance is not worth driving: clean up and relaunch.

## Drive

The flagship proof is the conflict summary, the Day view's conflict marks and the Agenda's conflict cards against the sample day:

```sh
node .claude/skills/verify/scripts/agenda-conflicts.mjs "$URL" "$ARTIFACTS/conflict-summary"
```

It works out the expected conflicts from `sampleDay()` with its own brute-force check (every pair, union-find). It does not use the app's `findConflicts`, so the app cannot pass by agreeing with itself. It then drives the user path:

1. Open `/` and read the header `status`.
2. In the Day view, read the session blocks marked `In conflict` and the gutter's `Conflicts` markers.
3. Click `Agenda` in the header's `View` switch.
4. Wait for `?view=agenda` and the list named `Agenda`.
5. Read the header `status` again.
6. Read every region named `N sessions overlap HH:mm – HH:mm`, including its `Sessions` list and its `Overlaps` list.

It exits 0 only if all of these match the oracle: both summaries, one Day block per session, exactly the conflicting sessions marked `In conflict`, one gutter marker per conflict with its time range, every card's name, sessions and per-pair shared minutes, every session outside a conflict sitting outside the cards, and no page errors. If a step fails (a missing element, a timeout), it still writes `report.json` with `failedStep` and `error`, plus `failure.png`, and exits 1.

The session dialog has its own proof, which adds, edits, deletes and clears sessions and checks each header summary against its own oracle:

```sh
node .claude/skills/verify/scripts/session-dialog.mjs "$URL" "$ARTIFACTS/session-dialog"
```

It prints one `ok`/`FAIL` line per check and ends with `PASS: N checks`, exiting 0. See [`features/session-dialog.md`](features/session-dialog.md).

Resolving conflicts from the Agenda has its own proof, with a brute-force oracle for each session's next free slot:

```sh
node .claude/skills/verify/scripts/conflict-resolution.mjs "$URL" "$ARTIFACTS/conflict-resolution"
```

It prints one `ok`/`FAIL` line per check and ends with `PASS: N checks`, exiting 0. See [`features/conflict-resolution.md`](features/conflict-resolution.md).

Dragging has its own proof too. It drives the mouse, the keyboard and CDP touch events, checks the live layout before each drop, the summary after it and the drag announcements, against its own oracle:

```sh
node .claude/skills/verify/scripts/drag.mjs "$URL" "$ARTIFACTS/drag"
```

It prints `PASS: N checks` and exits 0. See [`features/drag.md`](features/drag.md).

For any other page state, capture evidence with:

```sh
node .claude/skills/verify/scripts/snap.mjs "$URL/?view=agenda" "$ARTIFACTS/<feature>" <name> [light|dark]
```

It waits for the page to hydrate (`networkidle`), then writes `<name>.png`, `<name>.aria.yaml` (the ARIA snapshot of the page) and `<name>.errors.json`. It exits 1 on any page error. The full-page screenshot does not scroll the Day grid, which has its own scroll area: it shows the hours from just above the first session.

**Hydration trap.** The page is rendered on the server, so it is visible before React hydrates. Clicks made before hydration are dropped without an error: a menu does not open, a button does nothing. Plain links still work, because the browser navigates. After every `goto`, call `await page.waitForLoadState("networkidle")` before clicking a button.

For a step-by-step interaction the scripts don't cover, write a short Node script that imports `chromium` from `@playwright/test` (see `scripts/snap.mjs`). Address elements by role and accessible name. The stable handles:

| Handle                                              | What it is                                                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `getByRole("status")`                               | header conflict summary: `2 conflicts · 5 sessions`, or `No conflicts`. With conflicts it holds a link of the same name that opens `?view=agenda` |
| `getByRole("button", { name: "New session" })`      | opens the session dialog empty                                                              |
| `getByRole("button", { name: "Clear day" })`        | empties the schedule at once, with no confirmation                                          |
| `getByRole("dialog", { name: "New session" })`      | the session dialog (`Edit session` when opened from a session); fields `Title`, `Start`     |
| `dialog.getByRole("list", { name: "Overlapping sessions" })` | the dialog's overlap preview, one `<title> HH:mm – HH:mm` / `N min` item per session |
| `getByRole("button", { name: "Add the first session" })` | the empty state's button, shown by both views when the schedule is empty               |
| `getByRole("button", { name: "Toggle theme" })`     | theme menu: `Light`, `Dark`, `System`                                                       |
| `getByRole("navigation", { name: "View" })`         | Day/Agenda switch: links `Day` and `Agenda`; the current one has `aria-current="page"`      |
| `getByRole("region", { name: "Day" })`              | the Day view's time grid                                                                    |
| `day.locator("time")`                               | today's date above the grid, `datetime="YYYY-MM-DD"`, from the browser's clock; absent before hydration |
| `day.getByRole("list", { name: "Sessions" })`       | the grid's session blocks, each a `listitem` named `<title>, HH:mm – HH:mm` holding a button that opens the session (click or Enter); pressing and moving the button drags it, and so do Space, the arrow keys and Space again |
| `locator("[data-drag-label]")`                      | the gutter label showing the landing start `HH:mm` during a drag; hidden from the accessibility tree, absent otherwise |
| `locator("[data-drag-announcer]")`                  | the Day view's visually hidden `aria-live` region: `Picked up …`, `<title> at HH:mm` per keyboard step, `<title> moved to HH:mm, overlaps N sessions`, `Move cancelled. …`. It has no role, so `getByRole("status")` stays unique |
| `getByRole("list", { name: "Conflicts" })`          | the gutter markers, one `Conflict HH:mm – HH:mm` item per conflict                          |
| `getByRole("link", { name: /^\+\d+ more session/ })` | the `+N` control for sessions folded past three lanes; it opens the Agenda filtered to their conflict (`&conflict=<ids>`) |
| `getByRole("link", { name: "Clear highlight" })`    | the Day view's focus bar (with `?conflict=`); back to `?view=day`. Highlighted blocks hold the hidden text `Highlighted` |
| `getByRole("list", { name: "Agenda" })`             | the Agenda; each item is a free slot, a session or a conflict card, in start order. Each session row outside a card is a button that opens the session. Absent on an empty day |
| `getByRole("link", { name: "Show all" })`           | the Agenda's focus bar (with `?conflict=`); back to `?view=agenda`                          |
| `getByRole("region", { name: /sessions overlap/ })` | one conflict card, with a `Show in Day view` link                                           |
| `card.getByRole("list", { name: "Sessions" })`      | that card's sessions; each item holds `Move to next free slot HH:mm – HH:mm` (or disabled `No free slot today`) and `Edit`, both described by the session title |
| `card.getByRole("list", { name: "Overlaps" })`      | that card's overlaps, one `A × B` / `N min` pair per item                                   |

## Evidence

Everything goes under `verify-artifacts/<RUN_ID>/<feature>/` at the repo root. Git ignores that directory, and cleanup never deletes it. A proof includes:

- the action and the state after it, not only the final screen (`agenda-conflicts.mjs` keeps `day.png` / `day.aria.yaml` from before the click and `agenda.png` / `agenda.aria.yaml` from after it);
- `report.json`, holding the expected values, the observed values and any mismatches;
- the page errors, which must be empty.

Proof standards:

- Go through the user's path: navigate and click. Do not render components or call schedule functions.
- Never fix the app to match a failing proof without reading the mismatch first.
- Never weaken a check so that it passes.
- Expected values come from `sample-day.ts`, never from copying what the app shows.
- When you change the sample day, the oracle follows it automatically. When you change what a conflict card or the summary says, update the oracle in the same change.

## Cleanup

```sh
.claude/skills/verify/scripts/verify.sh cleanup "$RUN_ID"   # the instance you launched
.claude/skills/verify/scripts/verify.sh cleanup --all       # every instance this script launched
```

Cleanup stops the server's process group and deletes its state in `$TMPDIR/conflict-scheduler-verify/<RUN_ID>/`. It never kills processes by name, and it keeps `verify-artifacts/<RUN_ID>/`. Run it after every run, including failed ones.

## Helpers

| Script                         | Invocation                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| `scripts/verify.sh`            | `verify.sh launch \| doctor RUN_ID \| url RUN_ID \| cleanup RUN_ID \| cleanup --all` |
| `scripts/agenda-conflicts.mjs` | `node .claude/skills/verify/scripts/agenda-conflicts.mjs <base-url> <artifact-dir>`: exit 0 means PASS |
| `scripts/session-dialog.mjs`   | `node .claude/skills/verify/scripts/session-dialog.mjs <base-url> <artifact-dir>`: exit 0 means PASS   |
| `scripts/conflict-resolution.mjs` | `node .claude/skills/verify/scripts/conflict-resolution.mjs <base-url> <artifact-dir>`: exit 0 means PASS |
| `scripts/drag.mjs`             | `node .claude/skills/verify/scripts/drag.mjs <base-url> <artifact-dir>`: exit 0 means PASS             |
| `scripts/snap.mjs`             | `node .claude/skills/verify/scripts/snap.mjs <url> <artifact-dir> <name> [light\|dark]`                |

The `.mjs` helpers import `src/schedule/sample-day.ts` directly. That needs Node 23.6 or later, where TypeScript type stripping is on by default (this machine has Node 26).
