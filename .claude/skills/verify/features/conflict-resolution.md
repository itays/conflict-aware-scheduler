# Conflict resolution

The Agenda's conflict cards are where conflicts get resolved. Each session in a card has `Move to next free slot`, which names where it will go and moves it to the earliest start, at or after its own and no later than 23:55, where it overlaps no other session. It also has `Edit`, which opens the session dialog. When nothing fits, the move button is disabled and reads `No free slot today`. Each card's `Show in Day view` link opens the Day view with that conflict's sessions highlighted. The header summary opens the Agenda, and the Day view's `+N` opens the Agenda filtered to its conflict. Both the filter and the highlight live in a `conflict` search parameter. A bar above the view says what is focused, or `This conflict is resolved.`, and links back to the whole view.

## Sub-features

- `move-target`: each card session's button reads `Move to next free slot HH:mm – HH:mm`, the range it would move to. On the sample day: System design `17:45 – 18:45`, Hiring sync `17:45 – 18:30`, Room 4B hold `11:15 – 12:00`, Culture interview `17:45 – 18:30`, Recruiter debrief `14:15 – 14:45`.
- `move-session`: clicking it moves the session there. The header count drops, a card left with one session disappears, and focus follows the session to its new row (`data-session-id`).
- `no-free-slot`: when no start up to 23:55 fits, the button is disabled and reads `No free slot today`.
- `card-edit`: `Edit` opens `dialog "Edit session"` for that session. Both buttons are described by the session's title (`aria-describedby`).
- `show-in-day`: `Show in Day view` goes to `?view=day&conflict=<ids>`. The conflict's blocks get a ring and a hidden `Highlighted` label, a bar reads `Highlighting the conflict at HH:mm – HH:mm.`, the grid opens above the conflict, and `Clear highlight` goes back to `?view=day`.
- `summary-opens-agenda`: the header summary, while there are conflicts, is a link to `?view=agenda` with no filter.
- `overflow-filter`: `+N` goes to `?view=agenda&conflict=<folded ids>`. The Agenda shows only that conflict's card under `Showing only the conflict at HH:mm – HH:mm.`, and `Show all` goes back to `?view=agenda`.
- `filter-resolved`: moving a session out of a filtered conflict keeps whatever is still in conflict in view. Once the filtered sessions are in no conflict, the bar reads `This conflict is resolved.`, even though sessions may remain where they were: a conflict needs two sessions, so one move resolves a two-session conflict and two moves resolve a three-session one. Focus goes to `Show all` when the filter hides the moved session.

## How to get to it (user POV)

- Open the Agenda, by the header's `View` switch or the conflict summary, and use the buttons in a conflict card.
- In the Day view, click a `+N` control (only on a day with more than three overlapping sessions).
- Share a URL with `?conflict=<session ids, comma-joined>` next to `view`.

## Driving it with Playwright

Preconditions:

- Baseline preconditions from the README.
- A fresh load. The proof makes its own changes and resets with `goto` between steps.

- **Full proof.** Run `node .claude/skills/verify/scripts/conflict-resolution.mjs "$URL" "$ARTIFACTS/conflict-resolution"`. It prints `PASS: 25 checks` and exits 0. In order, it:
  - clicks the summary in the Day view and checks it lands on `?view=agenda` with every card;
  - checks every card session's move button against a brute-force oracle that tries each 5-minute start up to 23:55;
  - clicks the first card's `Show in Day view`, checks the `conflict` ids, the highlighted blocks and the bar, then `Clear highlight`;
  - moves `Recruiter debrief` and checks the summary, the card gone, and focus on its new row;
  - opens the first conflict filtered, moves one session at a time until it is no longer a conflict (two moves on the sample day, leaving `Room 4B hold` in place) and the bar reads `This conflict is resolved.`, checking the cards left and focus on `Show all`, then `Show all`;
  - adds `Extra hold` at 10:45, clicks `+1`, checks the Agenda shows only that conflict, then `Show all`;
  - adds a 24-hour `All day` session and checks every button reads `No free slot today` and is disabled.
- **Evidence.** `agenda.png`, `day-highlight.png`, `after-move.png`, `filtered.png`, `filtered-resolved.png`, `overflow-filtered.png`, `no-free-slot.png` and `report.json`.
- **Read a failure.** Open `report.json`. Each failed check has `ok: false` and a `detail`. The move-target checks list `{ title, expected, found, disabled }` per mismatch. A step that threw is recorded as `step "<name>" ran`, with `failure.png`.

## Gotchas

- Playwright's `getByRole` cannot filter by accessible description, so the script finds a session's buttons inside its card row: `region` → `list "Sessions"` → `listitem` filtered by title.
- The `conflict` parameter holds session ids, not a conflict id. The focus is every conflict that still holds any of those sessions, so a filter survives one session moving out. An id that matches no conflict (`?conflict=bogus`) shows `This conflict is resolved.` with no page errors.
- The browser encodes the comma in the URL as `%2C`. Read the parameter with `searchParams`, not by matching the raw URL.
- The Day grid's opening scroll is capped by its height. At a 900px-tall viewport its top stops at about 11:50 (`scrollTop` 710), so `?conflict=culture,debrief` opens there, not 30 minutes above 13:30, with the conflict lower in view.
- Sample session ids (`hiring-sync`, `debrief`, …) come from `sample-day.ts`. Sessions added in the dialog get random ids.
