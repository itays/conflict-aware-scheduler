# Conflict summary

The header shows how much needs attention: the number of conflicts and the number of sessions caught in them, such as `2 conflicts · 5 sessions`, or `No conflicts`. The counts must match the overlapping sessions in the schedule. Back-to-back sessions never count.

## Sub-features

- `summary-counts`: the conflict count and affected-session count match the sample day.
- `summary-every-view`: the same summary shows in the Day view and the Agenda.
- `summary-day-marks`: the Day view marks exactly the counted sessions `In conflict` and shows one gutter marker per counted conflict.
- `summary-cards-agree`: the Agenda shows one card per counted conflict, holding exactly the counted sessions and each overlap's shared minutes.

## How to get to it (user POV)

- Open the app at `/`. The summary is in the header.
- Open the Agenda (`?view=agenda`) to see the conflicts behind the numbers.

## Driving it with Playwright

Preconditions:

- Baseline preconditions from the README.
- `sample-day.ts` is the schedule. The app has no other way to load data yet.

- **Full proof.** Run `node .claude/skills/verify/scripts/agenda-conflicts.mjs "$URL" "$ARTIFACTS/conflict-summary"`. It prints `PASS: "2 conflicts · 5 sessions" with 2 matching conflict cards and Day view marks` and exits 0.
  - It reads the summary on `/` and again after clicking `Agenda` in the header's `View` switch.
  - On `/` it checks that the five sessions marked `In conflict` and the markers `Conflict 10:30 – 11:15` and `Conflict 14:00 – 14:15` match the oracle.
  - It compares each region named `3 sessions overlap 10:30 – 11:15` and `2 sessions overlap 14:00 – 14:15` with an independent pairwise oracle.
  - The evidence is `day.png` and `day.aria.yaml` (before the click), plus `agenda.png`, `agenda.aria.yaml` and `report.json` (after it).
- **Read a failure.** On exit 1, open `$ARTIFACTS/conflict-summary/report.json`. `mismatches[]` names each check that failed, with `actual` and `expected`. If a step could not run at all, `failedStep` and `error` say which and why, and `failure.png` shows the page at that moment.

## Gotchas

- `agenda-conflicts.mjs` reaches the Agenda through the header's `View` switch. If the switch's names change, update the click in the script and this file together.
- The Agenda's conflict cards also hold lists named `Sessions`. Scope the Day view's `Sessions` list to `region "Day"` so a query never picks up a card's list.
- The oracle reads `sampleDay()` directly. Editing the sample day changes the expected values without any edit here. That is intended, not a reason to hard-code the counts.
- Free slots and back-to-back notes sit between cards, so never count conflicts by counting the Agenda's list items. Count regions named `… sessions overlap …`.
- This proves the dev build. The production build's summary is covered by `bun run test:e2e:smoke`.
