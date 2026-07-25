import { assert } from "@open-wc/testing"
import * as Boost from "../../"
import { StreamActions } from "../../"

test("Boost interface", () => {
  assert.equal(typeof Boost.StreamActions, "object")
  assert.equal(typeof Boost.start, "function")
  assert.equal(typeof Boost.registerAdapter, "function")
  assert.equal(typeof Boost.visit, "function")
  assert.equal(typeof Boost.connectStreamSource, "function")
  assert.equal(typeof Boost.disconnectStreamSource, "function")
  assert.equal(typeof Boost.renderStreamMessage, "function")
  assert.equal(typeof Boost.setProgressBarDelay, "function")
  assert.equal(typeof Boost.setConfirmMethod, "function")
  assert.equal(typeof Boost.setFormMode, "function")
  assert.equal(typeof Boost.config, "object")
  assert.equal(typeof Boost.navigator, "object")
  assert.equal(typeof Boost.session, "object")
  assert.equal(typeof Boost.session.drive, "boolean")
  assert.equal(typeof Boost.session.formMode, "string")
  assert.equal(typeof Boost.fetch, "function")
  assert.equal(typeof Boost.morphElements, "function")
  assert.equal(typeof Boost.morphChildren, "function")
  assert.equal(typeof Boost.morphBodyElements, "function")
  assert.equal(typeof Boost.morphBoostFrameElements, "function")
})

test("Session interface", () => {
  const { session, config } = Boost

  assert.equal(true, session.drive)
  assert.equal(true, config.drive.enabled)
  assert.equal("on", session.formMode)
  assert.equal("on", config.forms.mode)

  session.drive = false
  session.formMode = "off"

  assert.equal(false, session.drive)
  assert.equal(false, config.drive.enabled)
  assert.equal("off", session.formMode)
  assert.equal("off", config.forms.mode)
})

test("StreamActions interface", () => {
  assert.equal(typeof StreamActions, "object")
})
