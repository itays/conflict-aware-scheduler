# Drag to move

In the Day view, a session block can be dragged up or down with a mouse, a pen or a finger to change its start. The duration never changes. The start moves in 15-minute steps counted from where it started (a 10:05 session moves to 10:20 or 09:50) and is held between 00:00 and 23:55, so a late session runs past midnight (ADR 0002). While dragging, a label in the hour gutter shows the start the session would land on, and the grid is laid out as if the session already sat there: its block, lanes, `In conflict` marks, hatching and gutter markers all follow every step. The header summary waits for the drop. Dropping commits the move even into a conflict (ADR 0001). Esc puts the session back. A click without movement still opens the session dialog.

## Sub-features

- `drag-mouse`: a mouse or pen drag starts after 5px of movement, so a plain click still opens `dialog "Edit session"`.
- `drag-touch`: a finger has to hold still for 250ms before it drags. A quicker swipe scrolls the grid, and a tap opens the editor.
- `drag-steps`: whole 15-minute steps from the original start, rounded to the nearest step.
- `drag-label`: a gutter label (`[data-drag-label]`, hidden from the accessibility tree) reads the landing start `HH:mm`. It is gone when the drag ends.
- `drag-live-layout`: mid-drag, the block's accessible name and text show the new time range, and its `In conflict` mark, hatching and the `Conflicts` gutter markers match the dragged position. The header `status` still shows the saved schedule.
- `drag-clamp`: pulling past the top stops at `00:00` and past the bottom at `23:55`. Holding the pointer at the grid's edge auto-scrolls it.
- `drag-drop`: the drop saves the new start through the same update the dialog uses. The summary updates, and no dialog opens.
- `drag-cancel`: Esc returns the block to its start and leaves the schedule alone. Releasing over the block afterwards does not open the editor.
- `drag-no-fold`: a dragged session never folds into `+N`. Past three lanes it takes the overflow lane, drawn over the `+N`, until dropped. After the drop it may fold like any other session.

## How to get to it (user POV)

- Open `/` or `/?view=day`, press on a session block and move it up or down.
- On a touch screen, hold a block for a moment, then move your finger.

## Driving it with Playwright

Preconditions:

- Baseline preconditions from the README.

- **Full proof.** Run `node .claude/skills/verify/scripts/drag.mjs "$URL" "$ARTIFACTS/drag"`. It prints one `ok`/`FAIL` line per check, ends with `PASS: 33 checks`, and exits 0. Expected summaries and gutter markers come from its own pairwise oracle over `sampleDay()` with the dragged start swapped in. In order, it:
  - checks the page has exactly one `status`;
  - drags `Standup sync` down 30px onto `Phone screen — Maya Cohen` and, before releasing, checks the label `09:00`, the block's new name, its `In conflict` mark and hatching, the gutter markers, and the unchanged summary. After the drop it checks `3 conflicts · 7 sessions`, the new name, no dialog and no label;
  - drags again and presses Esc, checking the original name, no label and the unchanged summary. Then it drags 10px, presses Esc, waits 200ms and releases over the block, checking that no dialog opens;
  - adds `Odd start` at 07:05 and drags it 20px, landing on `07:20`;
  - holds the pointer at the grid's top edge with `Standup sync` until the label settles on `00:00`, then does the same at the bottom edge with `Panel wrap-up` until `23:55`. It drops both and checks `continues tomorrow` and the summary;
  - drags `Lunch with candidate` to 10:45, a fourth lane, and checks it stays listed. After the drop it checks that it folds into `+1 more session`;
  - clicks `Hiring sync` without moving and checks `dialog "Edit session"`;
  - in a Pixel 7 context it sends CDP touch events: a 400ms hold then a 30px move lands Standup on `09:00`; a quick swipe on Phone screen scrolls the grid and moves nothing; a tap opens the editor.
- **Evidence.** `mid-drag.png`, `after-drop.png`, `clamp-top.png`, `clamp-bottom.png`, `fourth-lane.png`, `touch-drag.png` and `report.json` (every check with its detail, plus page errors).
- **Read a failure.** Open `report.json`. A step that threw is recorded as `step "<name>" ran`, with `failure.png`, or `failure-touch.png` for the touch steps.
- **Production build.** `bun run test:e2e` runs `e2e/drag.e2e.ts` against the built app: a mouse drop that adds a conflict, Esc, and the release after Esc.

## Gotchas

- Drag after `networkidle`. Before hydration the blocks have no listeners, and pressing and moving does nothing.
- Move the mouse in several steps (`page.mouse.move(x, y, { steps: 10 })`), so the checks see the layout between steps.
- Playwright's `touchscreen` can only tap. A touch drag needs CDP `Input.dispatchTouchEvent`, as the script does, with a hold of at least 250ms before the first move.
- While dragging, the block keeps its original CSS `top` and is moved by a `transform`, because dnd-kit measures the node ignoring transforms. Read the position from the accessible name, not from `style.top`.
- dnd-kit's own `role="status"` live region sits inside a `hidden` element, so `getByRole("status")` still finds only the header summary. If a second `status` ever appears, that region has escaped.
