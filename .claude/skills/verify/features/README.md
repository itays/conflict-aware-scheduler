# Scheduler verification map

This directory is the maintained source for verifying what a user sees in the Conflict-Aware Scheduler. Read this index before driving the app, then use the matching feature file as the recipe.

## Baseline preconditions

- An instance launched by this run with `.claude/skills/verify/scripts/verify.sh launch`, with `RUN_ID`, `URL` and `ARTIFACTS` taken from its output.
- `verify.sh doctor "$RUN_ID"` prints no `FAIL` line.
- A fresh page load: the schedule is in memory and every load starts from the sample day in `src/schedule/sample-day.ts`. Its 11 sessions include back-to-back sessions, two conflicts covering five sessions, and one session running past midnight.
- Never drive an instance this run did not launch.

## Driving conventions

- Run every command from the repo root.
- After `goto`, wait for `networkidle` before clicking anything that is not a plain link. The server sends the page as HTML before React hydrates, and clicks made before hydration are dropped without an error.
- Prefer ARIA roles and accessible names (see the handle table in `../SKILL.md`) over CSS selectors or DOM position.
- Take expected values from `sample-day.ts`, never from what the app renders.
- Nothing persists, so there is nothing to restore after a run. Edits made through the session dialog or `Clear day` last only until the next load: a reload is a reset.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final screen.
- UI proof is an ARIA snapshot plus a screenshot with the `Scheduler` header visible, written under `$ARTIFACTS/<feature>/`.
- Every proof records an empty list of page errors.
- Record the feature file and entry point used with every artifact.
- If a path can't be reached, report the command you tried and the precondition that wasn't met. Never report it as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 and one paragraph on the user-visible behavior, then exactly four H2s in this order: `Sub-features`, `How to get to it (user POV)`, `Driving it with Playwright`, and `Gotchas`.

## Features

- [Conflict summary](./conflict-summary.md): the header count of conflicts and affected sessions, proved against the sample day together with the Day view's marks and the Agenda's cards.
- [Day view](./day-view.md): the time grid with lanes, hatched overlap minutes, gutter markers, the `+N` overflow and the past-midnight cue.
- [Agenda view](./agenda-view.md): the sample day in start order, with free slots, back-to-back notes, conflict cards and the past-midnight session.
- [Conflict resolution](./conflict-resolution.md): moving a card session to its next free slot, `No free slot today`, `Edit`, `Show in Day view` with its highlight, and the `conflict` filter opened by the summary and `+N`.
- [View parameter](./view-param.md): the `view` and `conflict` search parameters, the `day` default, unknown values, and the header's Day/Agenda switch.
- [Drag to move](./drag.md): dragging a Day block by mouse, pen, touch or keyboard in 15-minute steps, with the live label, live conflict marks, clamping, Esc, the drop, and the screen reader announcements.
- [Session dialog](./session-dialog.md): adding, editing and deleting sessions through one dialog, its overlap preview and validation, focus return, and `Clear day` with the empty states.
- [Today's date](./today.md): the viewer's local date above whichever view is showing.
- [Theme](./theme.md): Light, Dark and System themes from the header menu.
