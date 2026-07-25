import * as Boost from "../../index"
import { assert } from "@open-wc/testing"

class DeprecatedAdapterSupportTest {
  locations = []
  // Adapter interface
  visitProposedToLocation(location, _options) {
    this.locations.push(location)
  }

  visitStarted(visit) {
    this.locations.push(visit.location)
    visit.cancel()
  }

  visitCompleted(_visit) {}

  visitFailed(_visit) {}

  visitRequestStarted(_visit) {}

  visitRequestCompleted(_visit) {}

  visitRequestFailedWithStatusCode(_visit, _statusCode) {}

  visitRequestFinished(_visit) {}

  visitRendered(_visit) {}

  formSubmissionStarted(_formSubmission) {}

  formSubmissionFinished(_formSubmission) {}

  pageInvalidated() {}
}

let adapter

setup(() => {
  adapter = new DeprecatedAdapterSupportTest()
  Boost.registerAdapter(adapter)
})

test("visit proposal location includes deprecated absoluteURL property", async () => {
  Boost.navigator.proposeVisit(new URL(window.location.toString()))
  assert.equal(adapter.locations.length, 1)

  const [location] = adapter.locations
  assert.equal(location.toString(), location.absoluteURL)
})

test("visit start location includes deprecated absoluteURL property", async () => {
  Boost.navigator.startVisit(window.location.toString(), "123")
  assert.equal(adapter.locations.length, 1)

  const [location] = adapter.locations
  assert.equal(location.toString(), location.absoluteURL)
})
