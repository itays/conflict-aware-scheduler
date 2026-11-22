# Agenda view

The Agenda shows the day as text, in start order. It lists each session with its start, end and duration, the free slots between sessions, a `Back-to-back, no conflict` note where one session ends as the next begins, and one card per conflict. A session that runs past midnight shows `ends next day`.

## Sub-features

- `agenda-order`: free slots, sessions and conflict cards appear in start order, and times use 24-hour HH:mm.
- `agenda-free-slots`: a `Free · <duration>` row covers each stretch with no session, including the stretches before the first session and after the last.
- `agenda-back-to-back`: touching sessions get a `Back-to-back, no conflict` note and are not grouped into a card.
- `agenda-conflict-card`: each card shows `N sessions overlap HH:mm – HH:mm`, its sessions, and each overlap's shared minutes.
- `agenda-midnight`: `On-call handoff` reads `23:30 – 00:30` with `ends next day`.

## How to get to it (user POV)

- Open `/?view=agenda` directly.
- Open `/` and click `Open the Agenda` in the Day placeholder.

## Driving it with Playwright

Preconditions:

- Baseline preconditions from the README.

- **Capture the Agenda.** Run `node .claude/skills/verify/scripts/snap.mjs "$URL/?view=agenda" "$ARTIFACTS/agenda-view" agenda`. It exits 0. The file `agenda.aria.yaml` contains a `list "Agenda"`.
- **Order and free slots.** In `agenda.aria.yaml`, the `Agenda` list's items read, in order:
  - `00:00 – 08:30 … Free · 8 h 30 min`
  - `08:30 – 09:00 … Standup sync`
  - `Back-to-back, no conflict` followed by `09:00 – 10:00 … Phone screen — Maya Cohen`
  - `Back-to-back, no conflict` followed by `region "3 sessions overlap 10:30 – 11:15"`
  - `11:30 – 12:00 … Free · 30 min`
  - …
  - the last item, `23:30 – 00:30 ends next day … On-call handoff`
- **Conflict cards.** The two `region` entries each hold a `list "Sessions"` and a `list "Overlaps"`. For the exact contents, checked against the sample day, run the conflict-summary proof (`conflict-summary.md`).
- **Midnight.** `agenda.png` shows `ends next day` under `23:30 – 00:30`.
- **Dark theme.** Run `node .claude/skills/verify/scripts/snap.mjs "$URL/?view=agenda" "$ARTIFACTS/agenda-view" agenda-dark dark`. In `agenda-dark.png`, the red cards and the sky session markers are readable on the dark background.

## Gotchas

- The leading free slot starts at `00:00`, not at 08:00 as on design board B. This is deliberate: a free slot is any stretch of the day with no session (`GLOSSARY.md`).
- A free slot that runs to the end of the day reads `24:00`, while a session end past midnight wraps (`00:30`). Do not read either as a bug.
- The TanStack devtools button sits bottom-right in the dev server only. Ignore it in screenshots.
