import { ProgressBar } from "../drive/progress_bar"
import { SystemStatusCode } from "../drive/visit"
import { uuid, dispatch } from "../../util"
import { locationIsVisitable } from "../url"
import type { Adapter } from "./adapter"
import type { Session } from "../session"
import type { Visit, VisitOptions } from "../drive/visit"
import type { FormSubmission } from "../drive/form_submission"

export interface StructuredReason {
  reason: string
  context?: Record<string, unknown>
}

export type ReloadReason = StructuredReason | undefined

export class BrowserAdapter implements Adapter {
  progressBar = new ProgressBar()

  declare readonly session: Session
  declare location?: URL
  declare redirectedToLocation?: URL | null
  declare visitProgressBarTimeout?: number
  declare formProgressBarTimeout?: number

  constructor(session: Session) {
    this.session = session
  }

  visitProposedToLocation(location: URL, options?: Partial<VisitOptions>) {
    if (locationIsVisitable(location, this.navigator.rootLocation)) {
      this.navigator.startVisit(location, options?.restorationIdentifier || uuid(), options)
    } else {
      window.location.href = location.toString()
    }
  }

  visitStarted(visit: Visit) {
    this.location = visit.location
    this.redirectedToLocation = null

    visit.issueRequest()
  }

  visitRequestStarted(_visit: Visit) {
    this.progressBar.setValue(0)
    this.showVisitProgressBarAfterDelay()
  }

  visitRequestCompleted(visit: Visit) {
    visit.loadResponse()

    if (visit.response?.redirected) {
      this.redirectedToLocation = visit.redirectedToLocation
    }
  }

  visitRequestFailedWithStatusCode(visit: Visit, statusCode: number | null) {
    switch (statusCode) {
      case SystemStatusCode.networkFailure:
      case SystemStatusCode.timeoutFailure:
      case SystemStatusCode.contentTypeMismatch:
        return this.reload({
          reason: "request_failed",
          context: {
            statusCode
          }
        })
      default:
        return visit.loadResponse()
    }
  }

  visitRequestFinished(_visit: Visit) {}

  visitCompleted(_visit: Visit) {
    this.progressBar.setValue(1)
    this.hideVisitProgressBar()
  }

  pageInvalidated(reason: ReloadReason) {
    this.reload(reason)
  }

  visitFailed(_visit: Visit) {
    this.progressBar.setValue(1)
    this.hideVisitProgressBar()
  }

  visitRendered(_visit: Visit) {}

  // Form Submission Delegate

  formSubmissionStarted(_formSubmission: FormSubmission) {
    this.progressBar.setValue(0)
    this.showFormProgressBarAfterDelay()
  }

  formSubmissionFinished(_formSubmission: FormSubmission) {
    this.progressBar.setValue(1)
    this.hideFormProgressBar()
  }

  // Private

  showVisitProgressBarAfterDelay() {
    this.visitProgressBarTimeout = window.setTimeout(this.showProgressBar, this.session.progressBarDelay)
  }

  hideVisitProgressBar() {
    this.progressBar.hide()
    if (this.visitProgressBarTimeout != null) {
      window.clearTimeout(this.visitProgressBarTimeout)
      delete this.visitProgressBarTimeout
    }
  }

  showFormProgressBarAfterDelay() {
    if (this.formProgressBarTimeout == null) {
      this.formProgressBarTimeout = window.setTimeout(this.showProgressBar, this.session.progressBarDelay)
    }
  }

  hideFormProgressBar() {
    this.progressBar.hide()
    if (this.formProgressBarTimeout != null) {
      window.clearTimeout(this.formProgressBarTimeout)
      delete this.formProgressBarTimeout
    }
  }

  showProgressBar = () => {
    this.progressBar.show()
  }

  reload(reason: ReloadReason) {
    dispatch("boost:reload", { detail: reason })

    window.location.href = (this.redirectedToLocation || this.location)?.toString() || window.location.href
  }

  get navigator() {
    return this.session.navigator
  }
}
