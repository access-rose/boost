import { test } from "@playwright/test"
import { nextEventNamed, readEventLogs } from "../helpers/page"

// one.html has no <meta name="boost-refresh-method">, proving reload() chooses
// morph on its own rather than relying on page configuration.
test.beforeEach(async ({ page }) => {
  await page.goto("/src/tests/fixtures/one.html")
  await readEventLogs(page)
})

test("Boost.reload() morphs the current page by default", async ({ page }) => {
  await page.evaluate(() => window.Boost.reload())
  await nextEventNamed(page, "boost:render", { renderMethod: "morph" })
})

test("Boost.reload({ method: 'replace' }) performs a full-body replace", async ({ page }) => {
  await page.evaluate(() => window.Boost.reload({ method: "replace" }))
  await nextEventNamed(page, "boost:render", { renderMethod: "replace" })
})

test("Boost.reload() reloads with no arguments, where session.refresh() is a no-op", async ({ page }) => {
  // session.refresh() with no url fails its isCurrentUrl guard and does nothing;
  // reload() skips those checks and always reloads.
  await page.evaluate(() => window.Boost.session.refresh())
  await page.evaluate(() => window.Boost.reload())
  await nextEventNamed(page, "boost:render", { renderMethod: "morph" })
})
