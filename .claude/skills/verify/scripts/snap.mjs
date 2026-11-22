#!/usr/bin/env node
// Open a page the way a user would and capture evidence of what it shows.
//
//   node snap.mjs <url> <artifact-dir> <name> [light|dark]
//
// Writes <name>.png (full page), <name>.aria.yaml (ARIA snapshot of <body>)
// and <name>.errors.json (uncaught page errors). Exits 1 on any page error.
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { chromium } from "@playwright/test"

const [url, outDir, name, colorScheme = "light"] = process.argv.slice(2)
if (!url || !outDir || !name) {
  console.error("usage: node snap.mjs <url> <artifact-dir> <name> [light|dark]")
  process.exit(2)
}
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({
  colorScheme,
  viewport: { width: 1280, height: 900 },
})
const errors = []
page.on("pageerror", (error) => errors.push(String(error)))

await page.goto(url)
await page.getByRole("status").waitFor()
await page.screenshot({ path: join(outDir, `${name}.png`), fullPage: true })
writeFileSync(
  join(outDir, `${name}.aria.yaml`),
  await page.locator("body").ariaSnapshot()
)
writeFileSync(
  join(outDir, `${name}.errors.json`),
  JSON.stringify(errors, null, 2)
)
await browser.close()

console.log(`captured ${name} from ${url} into ${outDir}`)
if (errors.length > 0) {
  console.error(`page errors:\n${errors.join("\n")}`)
  process.exit(1)
}
