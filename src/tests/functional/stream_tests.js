import { expect, test } from "@playwright/test"
import {
  nextEventNamed,
  nextEventOnTarget,
  noNextEventOnTarget,
  readEventLogs
} from "../helpers/page"

test.beforeEach(async ({ page }) => {
  await page.goto("/src/tests/fixtures/stream.html")
  await readEventLogs(page)
})

test("receiving a stream message", async ({ page }) => {
  const messages = page.locator("#messages .message")

  await expect(messages).toHaveText(["First"])

  await page.click("#append-target button")

  await expect(messages).toHaveText(["First", "Hello world!"])
})

test("dispatches a boost:before-stream-render event", async ({ page }) => {
  await page.click("#append-target button")
  await nextEventNamed(page, "boost:submit-end")
  const [[type, { newStream }, target]] = await readEventLogs(page, 1)

  expect(type).toEqual("boost:before-stream-render")
  expect(target).toEqual("a-boost-stream")
  expect(newStream).toContain(`action="append"`)
  expect(newStream).toContain(`target="messages"`)
})

test("receiving a stream message with css selector target", async ({ page }) => {
  const messages2 = page.locator("#messages_2 .message")
  const messages3 = page.locator("#messages_3 .message")

  await expect(messages2).toHaveText(["Second"])
  await expect(messages3).toHaveText(["Third"])

  await page.click("#append-targets button")

  await expect(messages2).toHaveText(["Second", "Hello CSS!"])
  await expect(messages3).toHaveText(["Third", "Hello CSS!"])
})

test("receiving a message without a template", async ({ page }) => {
  await page.evaluate(() =>
    window.Boost.renderStreamMessage(`
      <boost-stream action="remove" target="messages"></boost-stream>
    `)
  )

  await expect(page.locator("#messages"), "removes target element").not.toBeAttached()
})

test("receiving a message with a <script> element", async ({ page }) => {
  await page.evaluate(() =>
    window.Boost.renderStreamMessage(`
      <boost-stream action="append" target="messages">
        <template>
          <script>
            const messages = document.querySelector("#messages .message")
            messages.textContent = "Hello from script"
          </script>
        </template>
      </boost-stream>
    `)
  )

  await expect(page.locator("#messages")).toHaveText("Hello from script")
})

test("overriding with custom StreamActions", async ({ page }) => {
  const html = "Rendered with Custom Action"

  await page.evaluate((html) => {
    const CustomActions = {
      customUpdate(newStream) {
        for (const target of newStream.targetElements) target.innerHTML = html
      }
    }

    addEventListener("boost:before-stream-render", ({ target, detail }) => {
      const stream = target

      const defaultRender = detail.render
      detail.render = CustomActions[stream.action] || defaultRender
    })

    window.Boost.renderStreamMessage(`
      <boost-stream action="customUpdate" target="messages">
        <template></template>
      </boost-stream>
    `)
  }, html)

  await expect(page.locator("#messages"), "evaluates custom StreamAction").toHaveText("Rendered with Custom Action")
})

test("receiving a stream message over SSE", async ({ page }) => {
  await page.evaluate(() => {
    document.body.insertAdjacentHTML(
      "afterbegin",
      `<boost-stream-source id="stream-source" src="/__turbo/messages"></boost-stream-source>`
    )
  })

  const streamSource = page.locator("#stream-source")

  await expect(streamSource).toHaveJSProperty("streamSource.readyState", await page.evaluate(() => EventSource.OPEN))

  const messages = page.locator("#messages .message")

  await expect(messages).toHaveText(["First"])

  await page.click("#async button")

  await expect(messages).toHaveText(["First", "Hello world!"])

  const readyState = await streamSource.evaluate((element) => {
    element.remove()

    return element.streamSource.readyState
  })
  expect(readyState).toEqual(await page.evaluate(() => EventSource.CLOSED))

  await page.click("#async button")

  await expect(messages).toHaveText(["First", "Hello world!"])
})

test("receiving an update stream message preserves focus if the activeElement has an [id]", async ({ page }) => {
  await page.locator("input#container-element").focus()
  await page.evaluate(() => {
    window.Boost.renderStreamMessage(`
      <boost-stream action="update" target="container">
        <template><textarea id="container-element"></textarea></template>
      </boost-stream>
    `)
  })

  await expect(page.locator("textarea#container-element:focus")).toBeFocused()
})

test("receiving a replace stream message preserves focus if the activeElement has an [id]", async ({ page }) => {
  await page.locator("input#container-element").focus()
  await page.evaluate(() => {
    window.Boost.renderStreamMessage(`
      <boost-stream action="replace" target="container-element">
        <template><textarea id="container-element"></textarea></template>
      </boost-stream>
    `)
  })

  await expect(page.locator("textarea#container-element:focus")).toBeFocused()
})

test("receiving a remove stream message preserves focus blurs the activeElement", async ({ page }) => {
  await page.locator("#container-element").focus()
  await page.evaluate(() => {
    window.Boost.renderStreamMessage(`
      <boost-stream action="remove" target="container-element"></boost-stream>
    `)
  })

  await expect(page.locator(":focus")).not.toBeAttached()
})

test("dispatches a boost:before-morph-element & boost:morph-element for each morph stream action", async ({ page }) => {
  await page.evaluate(() => {
    window.Boost.renderStreamMessage(`
      <boost-stream action="replace" method="morph" target="message_1">
        <template>
          <div id="message_1">
            <h1>Morphed</h1>
          </div>
        </template>
      </boost-stream>
    `)
  })

  await nextEventOnTarget(page, "message_1", "boost:before-morph-element")
  await nextEventOnTarget(page, "message_1", "boost:morph-element")
  await expect(page.locator("#message_1")).toHaveText("Morphed")
})

test("preventing a boost:before-morph-element prevents the morph", async ({ page }) => {
  await page.evaluate(() => {
    addEventListener("boost:before-morph-element", (event) => {
      event.preventDefault()
    })
  })

  await page.evaluate(() => {
    window.Boost.renderStreamMessage(`
      <boost-stream action="replace" method="morph" target="message_1">
        <template>
          <div id="message_1">
            <h1>Morphed</h1>
          </div>
        </template>
      </boost-stream>
    `)
  })

  await nextEventOnTarget(page, "message_1", "boost:before-morph-element")
  await noNextEventOnTarget(page, "message_1", "boost:morph-element")
  await expect(page.locator("#message_1")).toHaveText("Morph me")
})

test("rendering a stream message into the HTML executes it", async ({ page }) => {
  await page.evaluate(() => {
    document.body.insertAdjacentHTML(
      "afterbegin",
      `
        <boost-stream action="append" target="messages">
          <template>
            <div class="message">Hello world!</div>
          </template>
        </boost-stream>
      `
    )
  })

  const messages = page.locator("#messages .message")
  await expect(messages).toHaveText(["First", "Hello world!"])
})
