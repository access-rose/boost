import { expect, test } from "@playwright/test"
import {
  clickWithoutScrolling,
  isScrolledToSelector,
  nextAttributeMutationNamed,
  nextBeat,
  nextBody,
  nextEventNamed,
  noNextEventNamed,
  pathname,
  pathnameForIFrame,
  readEventLogs,
  visitAction,
  willChangeBody,
  withHash,
  withPathname,
  withSearch,
  withSearchParam
} from "../helpers/page"

test.beforeEach(async ({ page }) => {
  await page.goto("/src/tests/fixtures/navigation.html")
  await readEventLogs(page)
})

test("navigating renders a progress bar until the next boost:load", async ({ page }) => {
  await page.evaluate(() => window.Boost.setProgressBarDelay(0))
  await page.click("#delayed-link")

  await expect(page.locator(".boost-progress-bar"), "displays progress bar").toBeAttached()

  await nextEventNamed(page, "boost:render")
  await expect(page.locator(".boost-progress-bar"), "displays progress bar").toBeAttached()

  await nextEventNamed(page, "boost:load")
  await expect(page.locator(".boost-progress-bar"), "hides progress bar").not.toBeAttached()
})

test("navigating does not render a progress bar before expiring the delay", async ({ page }) => {
  await page.evaluate(() => window.Boost.setProgressBarDelay(1000))
  await page.click("#same-origin-unannotated-link")

  await expect(page.locator(".boost-progress-bar"), "does not show progress bar before delay").not.toBeAttached()
})

test("navigating hides the progress bar on failure", async ({ page }) => {
  await page.evaluate(() => window.Boost.setProgressBarDelay(0))
  await page.click("#delayed-failure-link")

  await expect(page.locator(".boost-progress-bar")).toBeAttached()
  await expect(page.locator(".boost-progress-bar")).not.toBeAttached()
})

test("after loading the page", async ({ page }) => {
  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/navigation.html"))
  expect(await visitAction(page)).toEqual("load")
})

test("following a same-origin unannotated link", async ({ page }) => {
  await page.click("#same-origin-unannotated-link")

  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/one.html"))
  expect(await visitAction(page)).toEqual("advance")
  expect(
    await nextAttributeMutationNamed(page, "html", "aria-busy"),
    "sets [aria-busy] on the document element"
  ).toEqual(
    "true"
  )
  expect(
    await nextAttributeMutationNamed(page, "html", "aria-busy"),
    "removes [aria-busy] from the document element"
  ).toEqual(
    null
  )
})

test("following a same-origin unannotated custom element link", async ({ page }) => {
  await nextBeat()
  await page.evaluate(() => {
    const shadowRoot = document.querySelector("#custom-link-element")?.shadowRoot
    const link = shadowRoot?.querySelector("a")
    link?.click()
  })

  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/one.html"))
  await expect(page).toHaveURL(withSearch(""))
  expect(await visitAction(page)).toEqual("advance")
})

test("drive enabled; click an element in the shadow DOM wrapped by a link in the light DOM", async ({ page }) => {
  await page.click("#shadow-dom-drive-enabled span")

  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/one.html"))
  expect(await visitAction(page)).toEqual("advance")
})

test("drive disabled; click an element in the shadow DOM within data-boost='false'", async ({ page }) => {
  await page.click("#shadow-dom-drive-disabled span")

  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/one.html"))
  expect(await visitAction(page)).toEqual("load")
})

test("drive enabled; click an element in the slot", async ({ page }) => {
  await page.click("#element-in-slot")

  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/one.html"))
  expect(await visitAction(page)).toEqual("advance")
})

test("drive disabled; click an element in the slot within data-boost='false'", async ({ page }) => {
  await page.click("#element-in-slot-disabled")

  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/one.html"))
  expect(await visitAction(page)).toEqual("load")
})

test("drive disabled; click an element in the nested slot within data-boost='false'", async ({ page }) => {
  await page.click("#element-in-nested-slot-disabled")

  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/one.html"))
  expect(await visitAction(page)).toEqual("load")
})

test("following a same-origin unannotated link with search params", async ({ page }) => {
  await page.click("#same-origin-unannotated-link-search-params")

  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/one.html"))
  await expect(page).toHaveURL(withSearch("?key=value"))
  expect(await visitAction(page)).toEqual("advance")
})

test("following a same-origin unannotated form[method=GET]", async ({ page }) => {
  await page.click("#same-origin-unannotated-form button")

  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/one.html"))
  expect(await visitAction(page)).toEqual("advance")
})

test("following a same-origin data-boost-method=get link", async ({ page }) => {
  await page.click("#same-origin-get-link-form")
  await nextEventNamed(page, "boost:submit-start")
  await nextEventNamed(page, "boost:submit-end")
  await nextEventNamed(page, "boost:load")

  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/navigation.html"))
  await expect(page).toHaveURL(withSearchParam("a", "one"))
  await expect(page).toHaveURL(withSearchParam("b", "two"))
})

test("following a same-origin data-boost-action=replace link", async ({ page }) => {
  await page.click("#same-origin-replace-link")

  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/one.html"))
  expect(await visitAction(page)).toEqual("replace")
})

test("following a same-origin GET form[data-boost-action=replace]", async ({ page }) => {
  await page.click("#same-origin-replace-form-get button")

  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/one.html"))
  expect(await visitAction(page)).toEqual("replace")
})

test("following a same-origin GET form button[data-boost-action=replace]", async ({ page }) => {
  await page.click("#same-origin-replace-form-submitter-get button")

  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/one.html"))
  expect(await visitAction(page)).toEqual("replace")
})

test("following a same-origin POST form[data-boost-action=replace]", async ({ page }) => {
  await page.click("#same-origin-replace-form-post button")

  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/one.html"))
  expect(await visitAction(page)).toEqual("replace")
})

test("following a same-origin POST form button[data-boost-action=replace]", async ({ page }) => {
  await page.click("#same-origin-replace-form-submitter-post button")
  await nextEventNamed(page, "boost:load")

  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/one.html"))
  expect(await visitAction(page)).toEqual("replace")
})

test("following a same-origin POST link with data-boost-action=replace", async ({ page }) => {
  await page.click("#same-origin-replace-post-link")

  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/one.html"))
  expect(await visitAction(page)).toEqual("replace")
})

test("following a same-origin data-boost=false link", async ({ page }) => {
  await page.click("#same-origin-false-link")
  await page.waitForEvent("load")
  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/one.html"))
  expect(await visitAction(page)).toEqual("load")
})

test("following a same-origin unannotated link inside a data-boost=false container", async ({ page }) => {
  await page.click("#same-origin-unannotated-link-inside-false-container")
  await page.waitForEvent("load")
  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/one.html"))
  expect(await visitAction(page)).toEqual("load")
})

test("following a same-origin data-boost=true link inside a data-boost=false container", async ({ page }) => {
  await page.click("#same-origin-true-link-inside-false-container")

  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/one.html"))
  expect(await visitAction(page)).toEqual("advance")
})

test("following a same-origin anchored link", async ({ page }) => {
  await page.click("#same-origin-anchored-link")

  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/one.html"))
  await expect(page).toHaveURL(withHash("#element-id"))
  expect(await visitAction(page)).toEqual("advance")
  expect(await isScrolledToSelector(page, "#element-id")).toEqual(true)
})

test("following a same-origin link to a named anchor", async ({ page }) => {
  await page.click("#same-origin-anchored-link-named")

  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/one.html"))
  await expect(page).toHaveURL(withHash("#named-anchor"))
  expect(await visitAction(page)).toEqual("advance")
  expect(await isScrolledToSelector(page, "[name=named-anchor]")).toEqual(true)
})

test("following a cross-origin unannotated link", async ({ page }) => {
  await page.click("#cross-origin-unannotated-link")

  await expect(page).toHaveURL("about:blank")
  expect(await visitAction(page)).toEqual("load")
})

test("following a same-origin [target] link", async ({ page }) => {
  const [popup] = await Promise.all([page.waitForEvent("popup"), page.click("#same-origin-targeted-link")])

  expect(pathname(popup.url())).toEqual("/src/tests/fixtures/one.html")
  expect(await visitAction(page)).toEqual("load")
})

test("following a _self [target] link", async ({ page }) => {
  await page.click("#self-targeted-link")

  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/one.html"))
  expect(await visitAction(page)).toEqual("advance")
})

test("following an empty [target] link", async ({ page }) => {
  await page.click("#empty-target-link")
  await nextBody(page)

  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/one.html"))
  expect(await visitAction(page)).toEqual("advance")
})

test("following a bare [target] link", async ({ page }) => {
  await page.click("#bare-target-link")
  await nextBody(page)

  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/one.html"))
  expect(await visitAction(page)).toEqual("advance")
})

test("following a same-origin [download] link", async ({ page }) => {
  expect(
    await willChangeBody(page, async () => {
      await page.click("#same-origin-download-link")
      await nextBeat()
    })
  ).toEqual(false)
  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/navigation.html"))
  expect(await visitAction(page)).toEqual("load")
})

test("following a same-origin link inside an SVG element", async ({ page }) => {
  const link = page.locator("#same-origin-link-inside-svg-element")
  await link.focus()
  await page.keyboard.press("Enter")

  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/one.html"))
  expect(await visitAction(page)).toEqual("advance")
})

test("following a cross-origin link inside an SVG element", async ({ page }) => {
  const link = page.locator("#cross-origin-link-inside-svg-element")
  await link.focus()
  await page.keyboard.press("Enter")

  await expect(page).toHaveURL("about:blank")
  expect(await visitAction(page)).toEqual("load")
})

// Playwright cannot auto-scroll to an <a> nested in <svg><text>, so page.click()
// fails its actionability check with "element is outside of the viewport" even
// with force: true. dispatchEvent drives the same click path the observer sees.
test("clicking a same-origin SVG link", async ({ page }) => {
  await page.dispatchEvent("#same-origin-link-inside-svg-element", "click")

  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/one.html"))
  expect(await visitAction(page)).toEqual("advance")
})

test("clicking an SVG link with a hash-only href scrolls to the anchor without a visit", async ({ page }) => {
  await page.dispatchEvent("#same-origin-anchored-svg-link", "click")

  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/navigation.html"))
  await expect(page).toHaveURL(withHash("#main"))
  expect(await visitAction(page)).toEqual("load")
  expect(await isScrolledToSelector(page, "#main"), "scrolled to #main").toEqual(true)
})

test("clicking the back button", async ({ page }) => {
  await page.click("#same-origin-unannotated-link")
  await nextEventNamed(page, "boost:load")
  await page.goBack()
  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/navigation.html"))
  expect(await visitAction(page)).toEqual("restore")
})

test("clicking the forward button", async ({ page }) => {
  await page.click("#same-origin-unannotated-link")
  await nextEventNamed(page, "boost:load")
  await page.goBack()
  await page.goForward()
  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/one.html"))
  expect(await visitAction(page)).toEqual("restore")
})

test("form submissions that redirect to a different location have a default advance action", async ({ page }) => {
  await page.click("#redirect-submit")
  await nextEventNamed(page, "boost:load")
  expect(await visitAction(page)).toEqual("advance")
})

test("form submissions that redirect to the current location have a default replace action", async ({ page }) => {
  await page.click("#refresh-submit")
  await nextEventNamed(page, "boost:load")
  expect(await visitAction(page)).toEqual("replace")
})

test("link targeting a disabled boost-frame navigates the page", async ({ page }) => {
  await page.click("#link-to-disabled-frame")

  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/frames/hello.html"))
})

test("skip link with hash-only path scrolls to the anchor without a visit", async ({ page }) => {
  expect(
    await willChangeBody(page, async () => {
      await page.click('a[href="#main"]')
    })
  ).not.toBeTruthy()

  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/navigation.html"))
  await expect(page).toHaveURL(withHash("#main"))
  expect(await isScrolledToSelector(page, "#main"), "scrolled to #main").toEqual(true)
})

test("skip link with hash-only path moves focus and changes tab order", async ({ page }) => {
  await page.click('a[href="#main"]')
  await nextBeat()
  await page.press("#main", "Tab")

  await expect(page.locator("#ignored-link"), "skips interactive elements before #main").not.toBeFocused()
  await expect(page.locator("#main *:focus"), "moves focus inside #main").toBeFocused()
  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/navigation.html"))
  await expect(page).toHaveURL(withHash("#main"))
})

test("same-page anchored replace link assumes the intention was a refresh", async ({ page }) => {
  await page.click("#refresh-link")

  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/navigation.html"))
  await expect(page).toHaveURL(withHash("#main"))
  expect(await isScrolledToSelector(page, "#main"), "scrolled to #main").toEqual(true)
})

test("navigating back to anchored URL", async ({ page }) => {
  await clickWithoutScrolling(page, 'a[href="#main"]', { hasText: "Skip Link" })
  await nextBeat()

  await clickWithoutScrolling(page, "#same-origin-unannotated-link")
  await nextBody(page)
  await nextBeat()

  await page.goBack()
  await nextBody(page)

  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/navigation.html"))
  await expect(page).toHaveURL(withHash("#main"))
  expect(await isScrolledToSelector(page, "#main"), "scrolled to #main").toEqual(true)
})

test("following a redirection", async ({ page }) => {
  await page.click("#redirection-link")

  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/one.html"))
  expect(await visitAction(page)).toEqual("replace")
  await expect(page.locator(".boost-progress-bar")).not.toBeAttached()
})

test("clicking the back button after redirection", async ({ page }) => {
  await page.click("#redirection-link")
  await nextBody(page)
  await page.goBack()
  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/navigation.html"))
  expect(await visitAction(page)).toEqual("restore")
})

test("same-page anchor visits do not trigger visit events", async ({ page }) => {
  const events = [
    "boost:before-visit",
    "boost:visit",
    "boost:before-render",
    "boost:render",
    "boost:load"
  ]

  for (const eventName of events) {
    await page.goto("/src/tests/fixtures/navigation.html")
    await readEventLogs(page)
    await page.click('a[href="#main"]')
    expect(await noNextEventNamed(page, eventName), `same-page links do not trigger ${eventName} events`).toEqual(true)
  }
})

test("same-page anchor visits inside an SVG element do not trigger visit events", async ({ page }) => {
  const events = ["boost:before-visit", "boost:visit", "boost:before-render", "boost:render", "boost:load"]

  for (const eventName of events) {
    await page.goto("/src/tests/fixtures/navigation.html")
    await readEventLogs(page)
    await page.dispatchEvent("#same-origin-anchored-svg-link", "click")
    expect(await noNextEventNamed(page, eventName), `same-page SVG links do not trigger ${eventName} events`).toEqual(true)
  }
})

test("correct referrer header", async ({ page }) => {
  page.click("#headers-link")
  await nextEventNamed(page, "boost:load")
  const pre = await page.textContent("pre")
  const headers = await JSON.parse(pre || "")
  expect(
    headers.referer,
    `referer header is correctly set`
  ).toEqual(
    "http://localhost:9000/src/tests/fixtures/navigation.html"
  )
})

test("double-clicking on a link", async ({ page }) => {
  await page.click("#delayed-link", { clickCount: 2 })
  await nextBeat()

  await nextEventNamed(page, "boost:load")

  await expect(page).toHaveURL(withPathname("/__turbo/delayed_response"))
  expect(await visitAction(page)).toEqual("advance")
})

test("does not fire boost:load twice after following a redirect", async ({ page }) => {
  await page.evaluate(() => {
    window.boostLoadCount = 0
    addEventListener("boost:load", () => window.boostLoadCount++)
  })

  page.click("#redirection-link")

  await nextBeat() // 301 redirect response

  await nextBeat() // 200 response
  await nextBody(page)
  await nextEventNamed(page, "boost:load")
  await nextBeat()

  expect(await page.evaluate(() => window.boostLoadCount)).toEqual(1)
})

test("navigating back whilst a visit is in-flight", async ({ page }) => {
  page.click("#delayed-link")
  await nextEventNamed(page, "boost:before-render")
  await page.goBack()

  expect(
    await nextEventNamed(page, "boost:visit"),
    "navigating back whilst a visit is in-flight starts a non-silent Visit"
  ).toBeTruthy()

  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/navigation.html"))
  expect(await visitAction(page)).toEqual("restore")
})

test("ignores links with a [target] attribute that target an iframe with a matching [name]", async ({ page }) => {
  await page.click("#link-target-iframe")
  await nextBeat()
  await noNextEventNamed(page, "boost:load")

  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/navigation.html"))
  expect(await pathnameForIFrame(page, "iframe")).toEqual("/src/tests/fixtures/one.html")
})

test("ignores links with a [target] attribute that targets an iframe with [name='']", async ({ page }) => {
  await page.click("#link-target-empty-name-iframe")
  await nextBeat()
  await noNextEventNamed(page, "boost:load")

  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/one.html"))
})

test("ignores forms with a [target=_blank] attribute", async ({ page }) => {
  const [popup] = await Promise.all([page.waitForEvent("popup"), page.click("#form-target-blank button")])

  await expect(popup).toHaveURL(withPathname("/src/tests/fixtures/one.html"))
})

test("ignores forms with a [target] attribute that targets an iframe with a matching [name]", async ({ page }) => {
  await page.click("#form-target-iframe button")
  await nextBeat()
  await noNextEventNamed(page, "boost:load")

  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/navigation.html"))
  expect(await pathnameForIFrame(page, "iframe")).toEqual("/src/tests/fixtures/one.html")
})

test("ignores forms with a button[formtarget=_blank] attribute", async ({ page }) => {
  const [popup] = await Promise.all([page.waitForEvent("popup"), page.click("#button-formtarget-blank")])

  await expect(popup).toHaveURL(withPathname("/src/tests/fixtures/one.html"))
})

test("ignores forms with a button[formtarget] attribute that targets an iframe with [name='']", async ({ page }) => {
  await page.click("#form-target-empty-name-iframe button")
  await nextBeat()
  await noNextEventNamed(page, "boost:load")

  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/one.html"))
})

test("ignores forms with a button[formtarget] attribute that targets an iframe with a matching [name]", async ({
  page
}) => {
  await page.click("#button-formtarget-iframe")
  await nextBeat()
  await noNextEventNamed(page, "boost:load")

  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/navigation.html"))
  expect(await pathnameForIFrame(page, "iframe")).toEqual("/src/tests/fixtures/one.html")
})

test("ignores forms with a [target] attribute that target an iframe with [name='']", async ({ page }) => {
  await page.click("#button-formtarget-empty-name-iframe")
  await nextBeat()
  await noNextEventNamed(page, "boost:load")

  await expect(page).toHaveURL(withPathname("/src/tests/fixtures/one.html"))
})
