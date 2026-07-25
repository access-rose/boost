import { expect, test } from "@playwright/test"

test("window variable with ESM", async ({ page }) => {
  await page.goto("/src/tests/fixtures/esm.html")
  await assertBoostInterface(page)
})

test("window variable with UMD", async ({ page }) => {
  await page.goto("/src/tests/fixtures/umd.html")
  await assertBoostInterface(page)
})

async function assertBoostInterface(page) {
  await assertTypeOf(page, "Boost", "object")
  await assertTypeOf(page, "Boost.StreamActions", "object")
  await assertTypeOf(page, "Boost.start", "function")
  await assertTypeOf(page, "Boost.registerAdapter", "function")
  await assertTypeOf(page, "Boost.visit", "function")
  await assertTypeOf(page, "Boost.connectStreamSource", "function")
  await assertTypeOf(page, "Boost.disconnectStreamSource", "function")
  await assertTypeOf(page, "Boost.renderStreamMessage", "function")
  await assertTypeOf(page, "Boost.setProgressBarDelay", "function")
  await assertTypeOf(page, "Boost.setConfirmMethod", "function")
  await assertTypeOf(page, "Boost.setFormMode", "function")
  await assertTypeOf(page, "Boost.navigator", "object")
  await assertTypeOf(page, "Boost.session", "object")
}

async function assertTypeOf(page, propertyName, propertyType) {
  const type = await page.evaluate((propertyName) => {
    const parts = propertyName.split(".")
    let object = window
    parts.forEach((_part, i) => {
      object = object[parts[i]]
    })
    return typeof object
  }, propertyName)

  expect(type, `Expected ${propertyName} to be ${propertyType}`).toEqual(propertyType)
}
