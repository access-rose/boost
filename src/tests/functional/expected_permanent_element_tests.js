import { expect, test } from "@playwright/test"
import { nextEventNamed, readEventLogs, strictElementEquals } from "../helpers/page"

test.beforeEach(async ({ page }) => {
  await page.goto("/src/tests/fixtures/expected_permanent_element.html")
  await readEventLogs(page)
})

const injectedCount = (page) => page.evaluate(() => window.widgetInjectedCount)

test("preserves a meta-declared expected permanent element across navigation", async ({ page }) => {
  const widget = page.locator("#widget")
  await expect(widget).toHaveText("Injected widget")
  expect(await injectedCount(page)).toEqual(1)

  await page.click("#link-with-meta")
  await nextEventNamed(page, "boost:render")

  await expect(page.locator("h1")).toHaveText("Target with meta")
  expect(await strictElementEquals(widget, page.locator("#widget"))).toEqual(true)
  expect(await injectedCount(page), "the widget was carried over, not re-injected").toEqual(1)

  await page.goBack()
  await nextEventNamed(page, "boost:render")
  expect(await strictElementEquals(widget, page.locator("#widget"))).toEqual(true)
  expect(await injectedCount(page)).toEqual(1)
})

test("does not preserve the widget when the destination page omits the ID", async ({ page }) => {
  await expect(page.locator("#widget")).toHaveText("Injected widget")

  await page.click("#link-without-meta")
  await nextEventNamed(page, "boost:render")

  await expect(page.locator("h1")).toHaveText("Target without meta")
  await expect(page.locator("#widget")).toHaveCount(0)
})

test("preserves an element registered with Boost.addExpectedPermanentId", async ({ page }) => {
  // Start on the meta-declared page, then navigate to a page that does NOT
  // declare the ID — a persistent programmatic registration keeps it preserved.
  await page.click("#link-without-meta")
  await nextEventNamed(page, "boost:render")

  const widget = await page.evaluateHandle(() => {
    const element = document.createElement("div")
    element.id = "prog-widget"
    element.textContent = "Programmatic widget"
    document.body.appendChild(element)
    window.Boost.addExpectedPermanentId("prog-widget")
    return element
  })

  await page.click("#to-b")
  await nextEventNamed(page, "boost:render")

  await expect(page.locator("h1")).toHaveText("Target with meta")
  const sameNode = await page.evaluate((original) => original === document.getElementById("prog-widget"), widget)
  expect(sameNode, "the programmatic widget is the same node after navigation").toEqual(true)

  // After removing the registration it is no longer preserved.
  await page.evaluate(() => window.Boost.removeExpectedPermanentId("prog-widget"))
  await page.click("#back-link")
  await nextEventNamed(page, "boost:render")

  await expect(page.locator("#prog-widget")).toHaveCount(0)
})

test("preserves an expected permanent element across a morph refresh", async ({ page }) => {
  await page.goto("/src/tests/fixtures/expected_permanent_element_morph.html")
  await readEventLogs(page)

  const widget = page.locator("#widget")
  await expect(widget).toHaveText("Injected widget")
  expect(await injectedCount(page)).toEqual(1)

  await page.evaluate(() => window.Boost.visit(window.location.href, { action: "replace" }))
  await nextEventNamed(page, "boost:render", { renderMethod: "morph" })

  expect(await strictElementEquals(widget, page.locator("#widget"))).toEqual(true)
  expect(await injectedCount(page), "the widget survived the morph, not re-injected").toEqual(1)
})

// Stamps a marker on the iframe's live document, then reports whether it's still
// there — a reloaded iframe gets a fresh contentWindow without the marker.
const stampFrame = (page, selector) =>
  page.evaluate(async (selector) => {
    const frame = document.querySelector(selector)
    while (frame.contentDocument?.readyState !== "complete") await new Promise(requestAnimationFrame)
    frame.contentWindow.boostReloadMarker = "kept"
  }, selector)

const frameMarker = (page, selector) =>
  page.evaluate((selector) => document.querySelector(selector)?.contentWindow?.boostReloadMarker, selector)

const supportsAtomicMove = (page) =>
  page.evaluate(() => typeof document.documentElement.moveBefore === "function")

test("does not reload an <iframe> inside an expected permanent element", async ({ page }) => {
  await page.goto("/src/tests/fixtures/expected_permanent_element_iframe.html")
  await readEventLogs(page)

  const widget = page.locator("#widget")
  await expect(page.locator("#widget-frame")).toHaveCount(1)
  await stampFrame(page, "#widget-frame")

  await page.click("#advance")
  await nextEventNamed(page, "boost:render")

  await expect(page.locator("h1")).toHaveText("Target with meta")
  expect(await strictElementEquals(widget, page.locator("#widget"))).toEqual(true)
  if (await supportsAtomicMove(page)) {
    expect(await frameMarker(page, "#widget-frame"), "the iframe was not reloaded").toEqual("kept")
  }

  // The widget is parked on <html>, outside the swapped <body>.
  const placement = await page.evaluate(() => {
    const element = document.getElementById("widget")
    return { onHtml: element.parentElement === document.documentElement, inBody: document.body.contains(element) }
  })
  expect(placement).toEqual({ onHtml: true, inBody: false })
})

test("does not reload an <iframe> inside a data-boost-permanent element", async ({ page }) => {
  await page.goto("/src/tests/fixtures/permanent_iframe.html")
  await readEventLogs(page)

  const permanent = page.locator("#perm")
  await stampFrame(page, "#perm-frame")

  await page.click("#advance")
  await nextEventNamed(page, "boost:render")

  await expect(page.locator("h1")).toHaveText("Permanent iframe target")
  expect(await strictElementEquals(permanent, page.locator("#perm"))).toEqual(true)
  if (await supportsAtomicMove(page)) {
    expect(await frameMarker(page, "#perm-frame"), "the iframe was not reloaded").toEqual("kept")
  }
})
