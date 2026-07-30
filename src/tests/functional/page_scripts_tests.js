import { test, expect } from "@playwright/test"
import { nextEventNamed, readEventLogs, refreshWithStream, withPathname } from "../helpers/page"

function readLog(page) {
  return page.evaluate(() => {
    const log = window.lifecycleLog || []
    window.lifecycleLog = []
    return log
  })
}

async function visit(page, selector) {
  await readEventLogs(page) // drop buffered events so nextEventNamed waits for the fresh boost:load
  await page.click(selector)
  await nextEventNamed(page, "boost:load")
  return readLog(page)
}

test("connects and renders the scripts a page declares, after the page's head scripts run", async ({ page }) => {
  await page.goto("/src/tests/fixtures/page_scripts_none.html")
  await readLog(page)

  // none declares no scripts, so nothing connects there; navigating to A adds an
  // external head <script> that sets window.dep — dep=true proves it was awaited
  // before connect ran.
  const log = await visit(page, "#link-a")

  expect(log).toEqual(["app:connect:dep=true", "a:connect:dep=true", "app:render", "a:render"])
})

test("renders each active script exactly once on the initial page load", async ({ page }) => {
  await page.goto("/src/tests/fixtures/page_scripts_a.html")
  const log = await readLog(page)

  const rendered = log.filter((entry) => entry.endsWith(":render"))
  expect(rendered).toEqual(["app:render", "a:render"])
})

test("disconnects departing scripts, connects entering ones, and keeps shared scripts connected", async ({ page }) => {
  await page.goto("/src/tests/fixtures/page_scripts_a.html")
  await readLog(page)

  // A (app a) -> B (app b boom): a leaves, b enters, app persists (render only).
  const log = await visit(page, "#link-b")

  expect(log).toEqual([
    "app:beforeLeave:/src/tests/fixtures/page_scripts_b.html",
    "a:disconnect",
    "b:connect:dep=true",
    "boom:connect",
    "app:render",
    "b:render"
  ])
})

test("a throwing connect handler does not break the navigation", async ({ page }) => {
  await page.goto("/src/tests/fixtures/page_scripts_a.html")
  await readLog(page)

  const log = await visit(page, "#link-b")

  // boom throws in connect, but b still connects and the render pass still runs.
  expect(log).toContain("boom:connect")
  expect(log).toContain("b:connect:dep=true")
  expect(log).toContain("b:render")
})

test("beforeLeave returning false cancels the navigation", async ({ page }) => {
  await page.goto("/src/tests/fixtures/page_scripts_editor.html")
  await readLog(page)
  await page.evaluate(() => (window.editorDirty = true))

  await page.click("#link-a")

  await expect(page, "stays on the editor page").toHaveURL(withPathname("/src/tests/fixtures/page_scripts_editor.html"))
  const log = await readLog(page)
  expect(log, "beforeLeave ran with the destination").toContain(
    "editor:beforeLeave:/src/tests/fixtures/page_scripts_a.html"
  )
  expect(log.join(","), "the destination never connected").not.toContain("a:connect")

  await page.evaluate(() => (window.editorDirty = false))
  const proceeded = await visit(page, "#link-a")
  expect(proceeded).toContain("a:connect:dep=true")
})

test("a connected script's beforeLeave blocks navigation regardless of destination", async ({ page }) => {
  await page.goto("/src/tests/fixtures/page_scripts_a.html")
  await readLog(page)
  await page.evaluate(() => (window.appAllowLeave = false))

  await page.click("#link-b")

  await expect(page, "app's guard cancels the visit").toHaveURL(
    withPathname("/src/tests/fixtures/page_scripts_a.html")
  )
  const log = await readLog(page)
  expect(log.join(","), "B never connected").not.toContain("b:connect")

  await page.evaluate(() => (window.appAllowLeave = true))
})

test("registering a script for a page already showing connects it immediately", async ({ page }) => {
  await page.goto("/src/tests/fixtures/page_scripts_a.html")
  const log = await readLog(page)
  expect(log.join(","), "late was declared but not yet registered").not.toContain("late:connect")

  const afterRegister = await page.evaluate(() => {
    window.Boost.registerScript("late", {
      connect() { window.lifecycleLog.push("late:connect:dep=" + !!window.dep) },
      render() { window.lifecycleLog.push("late:render") }
    })
    const log = window.lifecycleLog
    window.lifecycleLog = []
    return log
  })

  expect(afterRegister).toEqual(["late:connect:dep=true", "late:render"])
})

test("one handler registered for several names connects on any of them", async ({ page }) => {
  await page.goto("/src/tests/fixtures/page_scripts_a.html")
  await readLog(page)

  const log = await visit(page, "#link-multi")

  expect(log).toContain("multi:connect:dep=true")
})

test("navigating back re-fetches and re-runs the lifecycle", async ({ page }) => {
  await page.goto("/src/tests/fixtures/page_scripts_a.html")
  await visit(page, "#link-b")

  await readEventLogs(page)
  await page.goBack()
  await nextEventNamed(page, "boost:load")
  const log = await readLog(page)

  // Restoration visits bypass the before-visit gate, so beforeLeave does not fire
  // on Back/Forward (documented scope limit) — but the render still tears down and
  // reconnects, and re-fetches the page so the awaited head script sets dep again.
  expect(log).toEqual(["b:disconnect", "a:connect:dep=true", "app:render", "a:render"])
})

test("a morph refresh re-renders active scripts without reconnecting them", async ({ page }) => {
  await page.goto("/src/tests/fixtures/page_scripts_a.html")
  await readLog(page)

  await refreshWithStream(page)
  await nextEventNamed(page, "boost:render", { renderMethod: "morph" })
  const log = await readLog(page)

  const rendered = log.filter((entry) => entry.endsWith(":render"))
  expect(rendered, "renders active scripts again").toEqual(["app:render", "a:render"])
  expect(log.join(","), "does not reconnect").not.toContain(":connect")
  expect(log.join(","), "does not disconnect").not.toContain(":disconnect")
})
