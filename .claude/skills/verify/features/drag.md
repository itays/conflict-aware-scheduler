# Drag to move

In the Day view, a session block can be dragged up or down with a mouse, a pen, a finger or the keyboard to change its start. The duration never changes. The start moves in 15-minute steps counted from where it started (a 10:05 session moves to 10:20 or 09:50) and is held between 00:00 and 23:55, so a late session runs past midnight (ADR 0002). While dragging, a label in the hour gutter shows the start the session would land on, and the grid is laid out as if the session already sat there: its block, lanes, `In conflict` marks, hatching and gutter markers all follow every step. The header summary waits for the drop. Dropping commits the move even into a conflict (ADR 0001). Esc puts the session back. A click without movement still opens the session dialog. With focus on a block, Space picks the session up, each up or down arrow moves it one step, Space drops it and Esc cancels. Every keyboard step is read out, and every drop and cancel is read out whatever started the drag.

## Sub-features

- `drag-mouse`: a mouse or pen drag starts after 5px of movement, so a plain click still opens `dialog "Edit session"`.
- `drag-touch`: a finger has to hold still for 250ms before it drags. A quicker swipe scrolls the grid, and a tap opens the editor.
- `drag-keyboard`: with focus on a block's button, Space picks the session up and each ArrowUp or ArrowDown moves it exactly one 15-minute step. Space or Enter drops it. Esc or Tab cancels, and so do resizing the window and hiding the tab. Focus stays on the block, and Enter outside a drag still opens the editor. While a session is held, ArrowLeft, ArrowRight, PageUp, PageDown, Home and End do nothing. The grid scrolls to keep the moving block in view. The button's description (`aria-describedby`) reads `Press Space to pick up, the up and down arrows to move 15 minutes, Space to drop and Escape to cancel.`
- `drag-steps`: whole 15-minute steps from the original start, rounded to the nearest step.
- `drag-label`: a gutter label (`[data-drag-label]`, hidden from the accessibility tree) reads the landing start `HH:mm`. It is gone when the drag ends.
- `drag-announce`: a visually hidden `aria-live="assertive"` region (`[data-drag-announcer]`) reads `Picked up <title> at HH:mm` on pick-up. Each keyboard step reads `<title> at HH:mm`, with `, the earliest start` or `, the latest start` added at 00:00 or 23:55. Pointer drags stay quiet between pick-up and drop. The drop reads `<title> moved to HH:mm, overlaps N session(s)` (or `no overlaps`; `stays at` when the start did not change). A cancel reads `Move cancelled. <title> stays at HH:mm`. Back-to-back sessions do not count as overlaps.
- `drag-focus`: a focused block shows an outline drawn outside the block and above its neighbours, so a 5-minute block still shows it. The button's accessible name holds the title and the time range.
- `drag-live-layout`: mid-drag, the block's accessible name and text show the new time range, and its `In conflict` mark, hatching and the `Conflicts` gutter markers match the dragged position. The header `status` still shows the saved schedule.
- `drag-clamp`: the start stops at `00:00` and `23:55`. A pointer held at the grid's edge auto-scrolls it to its end. The pointer holds the block where it grabbed it, so at the bottom edge the start sits just above the end of the day: Panel wrap-up, held by its middle, reads `23:45` there. Pulling below the grid reaches `23:55` and stops. On the keyboard, presses past either limit are not counted, so the first press back moves at once.
- `drag-drop`: the drop saves the new start through the same update the dialog uses. The summary updates, and no dialog opens.
- `drag-cancel`: Esc returns the block to its start and leaves the schedule alone. After a pointer drag, releasing over the block does not open the editor.
- `drag-no-fold`: a dragged session never folds into `+N`. Past three lanes it takes the overflow lane, drawn over the `+N`, until dropped. After the drop it may fold like any other session.

## How to get to it (user POV)

- Open `/` or `/?view=day`, press on a session block and move it up or down.
- On a touch screen, hold a block for a moment, then move your finger.
- Tab to a session block, press Space, use the up and down arrows, then press Space again.

## Driving it with Playwright

Preconditions:

- Baseline preconditions from the README.

- **Full proof.** Run `node .claude/skills/verify/scripts/drag.mjs "$URL" "$ARTIFACTS/drag"`. It prints one `ok`/`FAIL` line per check, ends with `PASS: 51 checks`, and exits 0. Expected summaries, gutter markers, landing starts and drop announcements come from its own pairwise oracle over `sampleDay()` with the dragged start swapped in. In order, it:
  - checks the page has exactly one `status`;
  - drags `Standup sync` down 30px onto `Phone screen — Maya Cohen` and, before releasing, checks the label `09:00`, the block's new name, its `In conflict` mark and hatching, the gutter markers, the unchanged summary, and that the announcer still reads only the pick-up. After the drop it checks the drop announcement, `3 conflicts · 7 sessions`, the new name, no dialog and no label;
  - drags again and presses Esc, checking the original name, no label and the unchanged summary. Then it drags 10px, presses Esc, waits 200ms and releases over the block, checking that no dialog opens;
  - adds `Odd start` at 07:05 and drags it 20px, landing on `07:20`;
  - holds the pointer at the grid's top edge with `Standup sync` until the label settles on `00:00`. It then holds `Panel wrap-up` at the bottom edge until the grid is scrolled to its end, pulls the pointer below the grid and checks `23:55`. It drops both and checks `continues tomorrow` and the summary;
  - drags `Lunch with candidate` to 10:45, a fourth lane, and checks it stays listed. After the drop it checks that it folds into `+1 more session`;
  - clicks `Hiring sync` without moving and checks `dialog "Edit session"`;
  - focuses `Hiring sync`'s button and checks its description and focus outline. It presses Space, ArrowDown twice and Space, checking the announcements, the label `11:00`, the unchanged summary mid-drag, then the saved start, the summary, focus and no dialog. Esc and Tab each cancel with `Move cancelled. Hiring sync stays at 11:00`, and Enter then opens the editor;
  - carries `Panel wrap-up` down with 30 arrow presses, so the grid scrolls, and checks it stops at `23:55, the latest start`. One ArrowUp moves to `23:45`, and the drop lands there. Forty ArrowUp presses on `Standup sync` stop at `00:00, the earliest start`;
  - in a Pixel 7 context it sends CDP touch events: a 400ms hold then a 30px move lands Standup on `09:00`; a quick swipe on Phone screen scrolls the grid and moves nothing; a tap opens the editor.
- **Evidence.** `mid-drag.png`, `after-drop.png`, `clamp-top.png`, `clamp-bottom.png`, `fourth-lane.png`, `keyboard-mid.png`, `keyboard-clamp.png`, `touch-drag.png` and `report.json` (every check with its detail, plus page errors).
- **Read a failure.** Open `report.json`. A step that threw is recorded as `step "<name>" ran`, with `failure.png`, or `failure-touch.png` for the touch steps.
- **Production build.** `bun run test:e2e` runs `e2e/drag.e2e.ts` against the built app: a mouse drop that adds a conflict, Esc, the release after Esc, 26 arrow presses that scroll the grid and land exactly on `23:30`, and a pointer drag that auto-scrolls and changes lane without jumping.

## Gotchas

- Drag after `networkidle`. Before hydration the blocks have no listeners, and pressing and moving does nothing.
- Move the mouse in several steps (`page.mouse.move(x, y, { steps: 10 })`), so the checks see the layout between steps.
- Playwright's `touchscreen` can only tap. A touch drag needs CDP `Input.dispatchTouchEvent`, as the script does, with a hold of at least 250ms before the first move.
- While dragging, the block keeps its original CSS `top` and is moved by a `transform`, because dnd-kit measures the node ignoring transforms. Read the position from the accessible name, not from `style.top`.
- dnd-kit's own `role="status"` live region sits inside a `hidden` element, so `getByRole("status")` still finds only the header summary. If a second `status` ever appears, that region has escaped. Read drag announcements from `[data-drag-announcer]`, which has no role.
- Keyboard drags do not use dnd-kit's drag distance. The app's own keyboard sensor counts presses and sets the landing start, because dnd-kit adds every grid scroll to a drag. A keyboard check that sees uneven steps after the grid scrolled is a real regression, not flakiness. The e2e test for it holds under `--repeat-each 12 --workers 8`.
- `aria-describedby` points at an id from `useId()`. If the description reads empty, check that the referenced element exists: dnd-kit's own ids drift between the server render and the client.
