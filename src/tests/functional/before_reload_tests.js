import { expect, test } from "@playwright/test"
import { nextEventNamed, readEventLogs, strictElementEquals, visitAction } from "../helpers/page"

// The source and target pages carry a different inline `data-boost-track="reload"`
// script, so navigating between them normally forces a full reload.
test.beforeEach(async ({ page }) => {
  await page.goto("/src/tests/fixtures/tracked_reload_cancel.html")
  await readEventLogs(page)
})

test("fires boost:before-reload and reloads by default on a tracked-element change", async ({ page }) => {
  await page.evaluate(() =>
    window.addEventListener(
      "boost:before-reload",
      (e) => localStorage.setItem("beforeReloadReason", e.detail.reason),
      { once: true }
    )
  )

  await page.click("#advance")
  await page.waitForURL("**/tracked_reload_cancel_target.html")

  expect(await visitAction(page)).toEqual("load")
  expect(await page.evaluate(() => localStorage.getItem("beforeReloadReason"))).toEqual("tracked_element_mismatch")
})

test("preventDefault() on boost:before-reload renders in place and preserves persistent elements", async ({ page }) => {
  await page.evaluate(() => window.addEventListener("boost:before-reload", (e) => e.preventDefault()))

  const permanent = page.locator("#permanent")
  await expect(permanent).toHaveText("A")

  await page.click("#advance")
  await nextEventNamed(page, "boost:render")

  // Rendered in place — a Drive render, not a full document reload.
  await expect(page.locator("h1")).toHaveText("Cancel target")
  expect(await visitAction(page)).toEqual("advance")

  // The persistent element is the same live node (it survived), and the incoming
  // tracked head script executed as part of the in-place render.
  expect(await strictElementEquals(permanent, page.locator("#permanent"))).toEqual(true)
  await expect(permanent).toHaveText("A")
  expect(await page.evaluate(() => window.trackedVersion)).toEqual("v2")
})
