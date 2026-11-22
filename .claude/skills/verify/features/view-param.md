# View parameter

The `view` search parameter picks the view, so a reload or a shared link opens the same one. `day` is the default and shows the time grid, and `agenda` shows the Agenda. Any other value falls back to `day`. The `View` switch in the header changes the parameter, by mouse or keyboard. A second, optional parameter, `conflict`, holds comma-joined session ids: the Agenda shows only their conflict and the Day view highlights it.

## Sub-features

- `view-default`: `/` opens the Day view and the URL becomes `/?view=day`.
- `view-agenda`: `/?view=agenda` opens the Agenda, and a reload keeps it.
- `view-unknown`: an unknown value such as `?view=bogus` opens the Day view without page errors.
- `view-switch`: the header's `View` switch holds links `Day` and `Agenda`. Clicking one, or pressing Enter on it, sets `?view=` to match, and the current one has `aria-current="page"`.
- `view-conflict`: `conflict` is set by a card's `Show in Day view` and by `+N`, and cleared by `Show all`, `Clear highlight`, the summary link and the `View` switch, which sends only `view`. A value that matches no conflict shows `This conflict is resolved.` without page errors.
- `view-keeps-edits`: switching views keeps sessions added or changed in the dialog. Only a reload goes back to the sample day.

## How to get to it (user POV)

- Type or share a URL with `?view=day`, `?view=agenda`, or no `view`, optionally with `&conflict=<ids>`.
- Click `Day` or `Agenda` in the header, or Tab to one and press Enter.

## Driving it with Playwright

Preconditions:

- Baseline preconditions from the README.

- **Default.** Run `curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' "$URL/"`. It prints `307 …/?view=day`.
- **Day view.** Run `node .claude/skills/verify/scripts/snap.mjs "$URL/" "$ARTIFACTS/view-param" day`. The file `day.aria.yaml` contains `region "Day"` and `navigation "View"`, whose links are `Day` (`/url: /?view=day`) and `Agenda` (`/url: /?view=agenda`).
- **Agenda.** Run `node .claude/skills/verify/scripts/snap.mjs "$URL/?view=agenda" "$ARTIFACTS/view-param" agenda`. The file `agenda.aria.yaml` contains `list "Agenda"`.
- **Unknown value.** Run `node .claude/skills/verify/scripts/snap.mjs "$URL/?view=bogus" "$ARTIFACTS/view-param" bogus-view`. It exits 0, and `bogus-view.aria.yaml` contains `region "Day"`.
- **Switch by mouse and keyboard.** Run:

  ```sh
  mkdir -p "$ARTIFACTS/view-param"
  node --input-type=module -e '
  import { chromium } from "@playwright/test"
  const [url, out] = process.argv.slice(1)
  const b = await chromium.launch(); const p = await b.newPage()
  const errors = []; p.on("pageerror", (e) => errors.push(String(e)))
  await p.goto(url + "/")
  const nav = p.getByRole("navigation", { name: "View" })
  console.log("day current:", await nav.getByRole("link", { name: "Day" }).getAttribute("aria-current"))
  await nav.getByRole("link", { name: "Agenda" }).click()
  await p.waitForURL(/view=agenda/); await p.getByRole("list", { name: "Agenda" }).waitFor()
  await p.screenshot({ path: out + "/switch-agenda.png" })
  console.log("after click:", new URL(p.url()).search)
  await p.waitForLoadState("networkidle")
  const day = nav.getByRole("link", { name: "Day" })
  for (let i = 0; i < 20 && !(await day.evaluate((el) => el === document.activeElement)); i++) await p.keyboard.press("Tab")
  await p.keyboard.press("Enter")
  await p.waitForURL(/view=day/); await p.getByRole("region", { name: "Day" }).waitFor()
  await p.screenshot({ path: out + "/switch-day-keyboard.png" })
  console.log("after Enter:", new URL(p.url()).search, "errors:", JSON.stringify(errors))
  await p.goto(url + "/?view=agenda&conflict=culture,debrief"); await p.getByRole("link", { name: "Show all" }).waitFor()
  await nav.getByRole("link", { name: "Day" }).click(); await p.waitForURL(/view=day/)
  console.log("switch drops conflict:", new URL(p.url()).search)
  await b.close()' "$URL" "$ARTIFACTS/view-param"
  ```

  It prints `day current: page`, `after click: ?view=agenda`, `after Enter: ?view=day errors: []`, and `switch drops conflict: ?view=day`.
- **Unmatched conflict.** Run `node .claude/skills/verify/scripts/snap.mjs "$URL/?view=day&conflict=bogus" "$ARTIFACTS/view-param" bogus-conflict`. It exits 0, and `bogus-conflict.aria.yaml` contains `This conflict is resolved.` and `link "Clear highlight"`.
- **Edits survive a switch.** The session dialog proof (`session-dialog.md`) adds a session in the Agenda, switches to Day and finds it in the grid.
- **Flagship.** `agenda-conflicts.mjs` (see `conflict-summary.md`) also clicks `Agenda` in the switch and waits for `?view=agenda`.

## Gotchas

- `list "Agenda"` is absent on an empty day. The recipes above run on a fresh load, which always has the sample day.
- The server answers `/` with a 307 to `/?view=day`. `curl` without `-L` sees no page.
- The switch is two plain links, so a click works even before hydration. Keyboard focus moves through the page from the top, so the Tab loop above presses Tab until the `Day` link has focus rather than counting presses.
