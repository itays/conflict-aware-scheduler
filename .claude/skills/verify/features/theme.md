# Theme

The `Toggle theme` button in the header opens a menu of `Light`, `Dark` and `System`. The chosen theme applies straight away, and the browser remembers it.

## Sub-features

- `theme-menu`: the `Toggle theme` button opens a menu with three radio items.
- `theme-dark`: choosing `Dark` puts the `dark` class on `<html>` and darkens the page, including the Day view's session blocks (`--session*` tokens). The red of conflict blocks and hatching (`--destructive`) turns lighter so it still reads on the dark background.
- `theme-system`: `System` follows the browser's colour scheme, live when it changes. It is the default with no stored choice.
- `theme-no-flash`: a script in the page head applies the stored theme before React hydrates, so a reload in `Dark` never shows the light theme first.

## How to get to it (user POV)

- Click the sun/moon button at the right of the header.

## Driving it with Playwright

Preconditions:

- Baseline preconditions from the README.
- A fresh browser context, so no theme is stored from an earlier run.

- **Pick Dark.** Run:

  ```sh
  mkdir -p "$ARTIFACTS/theme"
  node --input-type=module -e '
  import { chromium } from "@playwright/test"
  const [url, out] = process.argv.slice(1)
  const b = await chromium.launch(); const p = await b.newPage({ colorScheme: "light" })
  await p.goto(url)
  await p.waitForLoadState("networkidle")
  await p.getByRole("button", { name: "Toggle theme" }).click()
  await p.getByRole("menuitemradio", { name: "Dark" }).click()
  await p.waitForFunction(() => document.documentElement.classList.contains("dark"))
  await p.screenshot({ path: out })
  console.log("html class:", await p.evaluate(() => document.documentElement.className))
  await b.close()' "$URL/?view=agenda" "$ARTIFACTS/theme/dark.png"
  ```

  It prints `html class: dark`, and `dark.png` shows the Agenda on a dark background. Pass `"$URL/?view=day"` instead to see the Day grid: the blue session blocks and the red, hatched conflict blocks stay readable on the dark card.
- **System.** Run `node .claude/skills/verify/scripts/snap.mjs "$URL/?view=agenda" "$ARTIFACTS/theme" system-dark dark`. With no stored choice, `system-dark.png` is dark. To prove it follows a live change, open the page with `colorScheme: "light"`, pick `System` from the menu, then call `page.emulateMedia({ colorScheme: "dark" })`: `<html>` gains `dark` without a reload.

## Gotchas

- The theme is kept in `localStorage` under `theme`. Reusing a browser context carries it into the next check.
- The menu items are `menuitemradio`, not `button`.
- Clicking `Toggle theme` before hydration does nothing, and the menu never opens. Wait for `networkidle` first.
