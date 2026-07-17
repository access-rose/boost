import { getVisitAction } from "../../util"
import { FormSubmission } from "./form_submission"
import { expandURL } from "../url"
import { Visit } from "./visit"
import { PageSnapshot } from "./page_snapshot"
import type { Action } from "../types"
import type { Locatable } from "../url"
import type { FetchResponse } from "../../http/fetch_response"
import type { FormSubmissionDelegate } from "./form_submission"
import type { VisitDelegate, VisitOptions } from "./visit"
import type { SubmitterElement } from "../config/forms"

export type NavigatorDelegate = VisitDelegate & {
  allowsVisitingLocationWithAction(location: URL, action?: Action): boolean
  visitProposedToLocation(location: URL, options: Partial<VisitOptions>): void
}

export class Navigator implements FormSubmissionDelegate {
  declare readonly delegate: NavigatorDelegate
  declare currentVisit?: Visit
  declare formSubmission?: FormSubmission

  constructor(delegate: NavigatorDelegate) {
    this.delegate = delegate
  }

  proposeVisit(location: URL, options: Partial<VisitOptions> = {}) {
    if (this.delegate.allowsVisitingLocationWithAction(location, options.action)) {
      this.delegate.visitProposedToLocation(location, options)
    }
  }

  startVisit(locatable: Locatable, restorationIdentifier: string, options: Partial<VisitOptions> = {}) {
    this.stop()
    this.currentVisit = new Visit(this, expandURL(locatable), restorationIdentifier, {
      referrer: this.location,
      ...options
    })
    this.currentVisit.start()
  }

  submitForm(form: HTMLFormElement, submitter?: SubmitterElement) {
    this.stop()
    this.formSubmission = new FormSubmission(this, form, submitter, true)

    this.formSubmission.start()
  }

  stop() {
    if (this.formSubmission) {
      this.formSubmission.stop()
      delete this.formSubmission
    }

    if (this.currentVisit) {
      this.currentVisit.cancel()
      delete this.currentVisit
    }
  }

  get adapter() {
    return this.delegate.adapter
  }

  get view() {
    return this.delegate.view
  }

  get rootLocation() {
    return this.view.snapshot.rootLocation
  }

  get history() {
    return this.delegate.history
  }

  // Form submission delegate

  formSubmissionStarted(formSubmission: FormSubmission) {
    // Not all adapters implement formSubmissionStarted
    if (typeof this.adapter.formSubmissionStarted === "function") {
      this.adapter.formSubmissionStarted(formSubmission)
    }
  }

  async formSubmissionSucceededWithResponse(formSubmission: FormSubmission, fetchResponse: FetchResponse) {
    if (formSubmission == this.formSubmission) {
      const responseHTML = await fetchResponse.responseHTML
      if (responseHTML) {
        const shouldCacheSnapshot = formSubmission.isSafe
        if (!shouldCacheSnapshot) {
          this.view.clearSnapshotCache()
        }

        const { statusCode, redirected } = fetchResponse
        const action = this.#getActionForFormSubmission(formSubmission, fetchResponse)
        const visitOptions = {
          action,
          shouldCacheSnapshot,
          response: { statusCode, responseHTML, redirected }
        }
        this.proposeVisit(fetchResponse.location, visitOptions)
      }
    }
  }

  async formSubmissionFailedWithResponse(formSubmission: FormSubmission, fetchResponse: FetchResponse) {
    const responseHTML = await fetchResponse.responseHTML

    if (responseHTML) {
      const snapshot = PageSnapshot.fromHTMLString(responseHTML)
      if (fetchResponse.serverError) {
        await this.view.renderError(snapshot, this.currentVisit)
      } else {
        await this.view.renderPage(snapshot, false, true, this.currentVisit)
      }
      if (snapshot.refreshScroll !== "preserve") {
        this.view.scrollToTop()
      }
      this.view.clearSnapshotCache()
    }
  }

  formSubmissionErrored(formSubmission: FormSubmission, error: unknown) {
    console.error(error)
  }

  formSubmissionFinished(formSubmission: FormSubmission) {
    // Not all adapters implement formSubmissionFinished
    if (typeof this.adapter.formSubmissionFinished === "function") {
      this.adapter.formSubmissionFinished(formSubmission)
    }
  }

  // Link prefetching

  linkPrefetchingIsEnabledForLocation(location: URL) {
    // Not all adapters implement linkPrefetchingIsEnabledForLocation
    if (typeof this.adapter.linkPrefetchingIsEnabledForLocation === "function") {
      return this.adapter.linkPrefetchingIsEnabledForLocation(location)
    }

    return true
  }

  // Visit delegate

  visitStarted(visit: Visit) {
    this.delegate.visitStarted(visit)
  }

  visitCompleted(visit: Visit) {
    this.delegate.visitCompleted(visit)
    delete this.currentVisit
  }

  // Same-page links are no longer handled with a Visit.
  // This method is still needed for Turbo Native adapters.
  locationWithActionIsSamePage(location: URL, action?: Action) {
    return false
  }

  // Visits

  get location() {
    return this.history.location
  }

  get restorationIdentifier() {
    return this.history.restorationIdentifier
  }

  #getActionForFormSubmission(formSubmission: FormSubmission, fetchResponse: FetchResponse): Action {
    const { submitter, formElement } = formSubmission
    return getVisitAction(submitter, formElement) || this.#getDefaultAction(fetchResponse)
  }

  #getDefaultAction(fetchResponse: FetchResponse): Action {
    const sameLocationRedirect = fetchResponse.redirected && fetchResponse.location.href === this.location?.href
    return sameLocationRedirect ? "replace" : "advance"
  }
}
