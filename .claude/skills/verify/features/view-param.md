# View parameter

The `view` search parameter picks the view, so a reload or a shared link opens the same one. `day` is the default and `agenda` shows the Agenda. Any other value falls back to `day`. Until issue #3 builds the Day view, `day` shows a placeholder with a link to the Agenda.

## Sub-features

- `view-default`: `/` opens the Day view and the URL becomes `/?view=day`.
- `view-agenda`: `/?view=agenda` opens the Agenda, and a reload keeps it.
- `view-unknown`: an unknown value such as `?view=bogus` opens the Day view without page errors.
- `view-placeholder-link`: `Open the Agenda` in the Day placeholder switches to the Agenda.

## How to get to it (user POV)

- Type or share a URL with `?view=day`, `?view=agenda`, or no `view`.
- Click `Open the Agenda` in the Day placeholder.

## Driving it with Playwright

Preconditions:

- Baseline preconditions from the README.

- **Default.** Run `curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' "$URL/"`. It prints `307 …/?view=day`.
- **Day placeholder.** Run `node .claude/skills/verify/scripts/snap.mjs "$URL/" "$ARTIFACTS/view-param" day`. The file `day.aria.yaml` contains `The Day view is on its way.` and `link "Open the Agenda"`, with `/url: /?view=agenda`.
- **Agenda.** Run `node .claude/skills/verify/scripts/snap.mjs "$URL/?view=agenda" "$ARTIFACTS/view-param" agenda`. The file `agenda.aria.yaml` contains `list "Agenda"`.
- **Unknown value.** Run `node .claude/skills/verify/scripts/snap.mjs "$URL/?view=bogus" "$ARTIFACTS/view-param" bogus-view`. It exits 0, and `bogus-view.aria.yaml` shows the Day placeholder.
- **Placeholder link.** Run `agenda-conflicts.mjs` (see `conflict-summary.md`). It clicks the link and waits for `?view=agenda`. `day.png` and `agenda.png` record the step.

## Gotchas

- The server answers `/` with a 307 to `/?view=day`. `curl` without `-L` sees no page.
- Issue #3 replaces the placeholder and its link with a Day/Agenda switch in the header. Rewrite `view-placeholder-link` and the click in `agenda-conflicts.mjs` when it lands.
