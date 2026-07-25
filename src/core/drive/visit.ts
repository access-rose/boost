import { FetchMethod, FetchRequest } from "../../http/fetch_request"
import type { FetchRequestDelegate } from "../../http/fetch_request"
import type { FetchResponse } from "../../http/fetch_response"
import { getAnchor } from "../url"
import { PageSnapshot } from "./page_snapshot"
import { getHistoryMethodForAction, uuid } from "../../util"
import { StreamMessage } from "../streams/stream_message"
import { ViewTransitioner } from "./view_transitioner"
import type { Action } from "../types"
import type { Adapter } from "../native/adapter"
import type { History, HistoryDirection } from "./history"
import type { PageView } from "./page_view"

export interface VisitDelegate {
  readonly adapter: Adapter
  readonly history: History
  readonly view: PageView

  visitStarted(visit: Visit): void
  visitCompleted(visit: Visit): void
}

export type VisitRefresh = { method?: string | null; scroll?: string | null }

export type VisitResponse = {
  statusCode: number
  redirected: boolean
  responseHTML?: string
}

export type VisitOptions = {
  action: Action
  historyChanged: boolean
  referrer?: URL
  response?: VisitResponse
  willRender: boolean
  updateHistory: boolean
  restorationIdentifier?: string
  frame?: string
  acceptsStreamResponse: boolean
  direction?: HistoryDirection | "none"
  refresh: VisitRefresh
}

export type TimingMetrics = Partial<Record<TimingMetric, number>>

const defaultOptions: VisitOptions = {
  action: "advance",
  historyChanged: false,
  willRender: true,
  updateHistory: true,
  acceptsStreamResponse: false,
  refresh: {}
}

export const TimingMetric = {
  visitStart: "visitStart",
  requestStart: "requestStart",
  requestEnd: "requestEnd",
  visitEnd: "visitEnd"
} as const

export type TimingMetric = (typeof TimingMetric)[keyof typeof TimingMetric]

export const VisitState = {
  initialized: "initialized",
  started: "started",
  canceled: "canceled",
  failed: "failed",
  completed: "completed"
} as const

export type VisitState = (typeof VisitState)[keyof typeof VisitState]

export const SystemStatusCode = {
  networkFailure: 0,
  timeoutFailure: -1,
  contentTypeMismatch: -2
} as const

export type SystemStatusCode = (typeof SystemStatusCode)[keyof typeof SystemStatusCode]

export const Direction = {
  advance: "forward",
  restore: "back",
  replace: "none"
} as const

export class Visit implements FetchRequestDelegate {
  identifier = uuid() // Required by boost-ios
  timingMetrics: TimingMetrics = {}

  followedRedirect = false
  historyChanged = false
  scrolled = false
  acceptsStreamResponse = false
  state: VisitState = VisitState.initialized
  viewTransitioner = new ViewTransitioner()

  declare readonly delegate: VisitDelegate
  declare readonly location: URL
  declare readonly restorationIdentifier: string
  declare readonly action: Action
  declare readonly referrer?: URL
  declare readonly willRender: boolean
  declare readonly updateHistory: boolean
  declare readonly direction: HistoryDirection | "none"
  declare readonly refresh: VisitRefresh
  declare response?: VisitResponse
  declare frame?: number
  declare request?: FetchRequest
  declare redirectedToLocation?: URL

  constructor(delegate: VisitDelegate, location: URL, restorationIdentifier?: string, options: Partial<VisitOptions> = {}) {
    this.delegate = delegate
    this.location = location
    this.restorationIdentifier = restorationIdentifier || uuid()

    const {
      action,
      historyChanged,
      referrer,
      response,
      willRender,
      updateHistory,
      acceptsStreamResponse,
      direction,
      refresh
    } = {
      ...defaultOptions,
      ...options
    }
    this.action = action
    this.historyChanged = historyChanged
    this.referrer = referrer
    this.response = response
    this.willRender = willRender
    this.updateHistory = updateHistory
    this.scrolled = !willRender
    this.acceptsStreamResponse = acceptsStreamResponse
    this.direction = direction || Direction[action]
    this.refresh = refresh
  }

  get adapter() {
    return this.delegate.adapter
  }

  get view() {
    return this.delegate.view
  }

  get history() {
    return this.delegate.history
  }

  get restorationData() {
    return this.history.getRestorationDataForIdentifier(this.restorationIdentifier)
  }

  start() {
    if (this.state == VisitState.initialized) {
      this.recordTimingMetric(TimingMetric.visitStart)
      this.state = VisitState.started
      this.adapter.visitStarted(this)
      this.delegate.visitStarted(this)
    }
  }

  cancel() {
    if (this.state == VisitState.started) {
      if (this.request) {
        this.request.cancel()
      }
      this.cancelRender()
      this.state = VisitState.canceled
    }
  }

  complete() {
    if (this.state == VisitState.started) {
      this.recordTimingMetric(TimingMetric.visitEnd)
      this.adapter.visitCompleted(this)
      this.state = VisitState.completed
      this.followRedirect()

      if (!this.followedRedirect) {
        this.delegate.visitCompleted(this)
      }
    }
  }

  fail() {
    if (this.state == VisitState.started) {
      this.state = VisitState.failed
      this.adapter.visitFailed(this)
      this.delegate.visitCompleted(this)
    }
  }

  changeHistory() {
    if (!this.historyChanged && this.updateHistory) {
      const actionForHistory = this.location.href === this.referrer?.href ? "replace" : this.action
      const method = getHistoryMethodForAction(actionForHistory)
      this.history.update(method, this.location, this.restorationIdentifier)
      this.historyChanged = true
    }
  }

  issueRequest() {
    if (this.hasPreloadedResponse()) {
      this.simulateRequest()
    } else if (this.shouldIssueRequest() && !this.request) {
      this.request = new FetchRequest(this, FetchMethod.get, this.location)
      this.request.perform()
    }
  }

  simulateRequest() {
    if (this.response) {
      this.startRequest()
      this.recordResponse()
      this.finishRequest()
    }
  }

  startRequest() {
    this.recordTimingMetric(TimingMetric.requestStart)
    this.adapter.visitRequestStarted(this)
  }

  recordResponse(response = this.response) {
    this.response = response
    if (response) {
      const { statusCode } = response
      if (isSuccessful(statusCode)) {
        this.adapter.visitRequestCompleted(this)
      } else {
        this.adapter.visitRequestFailedWithStatusCode(this, statusCode)
      }
    }
  }

  finishRequest() {
    this.recordTimingMetric(TimingMetric.requestEnd)
    this.adapter.visitRequestFinished(this)
  }

  loadResponse() {
    if (this.response) {
      const { statusCode, responseHTML } = this.response
      this.render(async () => {
        if (this.view.renderPromise) await this.view.renderPromise

        if (isSuccessful(statusCode) && responseHTML != null) {
          const snapshot = PageSnapshot.fromHTMLString(responseHTML)
          await this.renderPageSnapshot(snapshot)

          this.adapter.visitRendered(this)
          this.complete()
        } else {
          await this.view.renderError(PageSnapshot.fromHTMLString(responseHTML), this)
          this.adapter.visitRendered(this)
          this.fail()
        }
      })
    }
  }

  followRedirect() {
    if (this.redirectedToLocation && !this.followedRedirect && this.response?.redirected) {
      this.adapter.visitProposedToLocation(this.redirectedToLocation, {
        action: "replace",
        response: this.response,
        willRender: false
      })
      this.followedRedirect = true
    }
  }

  // Fetch request delegate

  prepareRequest(request: FetchRequest) {
    if (this.acceptsStreamResponse) {
      request.acceptResponseType(StreamMessage.contentType)
    }
  }

  requestStarted() {
    this.startRequest()
  }

  requestPreventedHandlingResponse(_request: FetchRequest, _response: FetchResponse) {}

  async requestSucceededWithResponse(request: FetchRequest, response: FetchResponse) {
    const responseHTML = await response.responseHTML
    const { redirected, statusCode } = response
    if (responseHTML == undefined) {
      this.recordResponse({
        statusCode: SystemStatusCode.contentTypeMismatch,
        redirected
      })
    } else {
      this.redirectedToLocation = response.redirected ? response.location : undefined
      this.recordResponse({ statusCode: statusCode, responseHTML, redirected })
    }
  }

  async requestFailedWithResponse(request: FetchRequest, response: FetchResponse) {
    const responseHTML = await response.responseHTML
    const { redirected, statusCode } = response
    if (responseHTML == undefined) {
      this.recordResponse({
        statusCode: SystemStatusCode.contentTypeMismatch,
        redirected
      })
    } else {
      this.recordResponse({ statusCode: statusCode, responseHTML, redirected })
    }
  }

  requestErrored(_request: FetchRequest, _error: unknown) {
    this.recordResponse({
      statusCode: SystemStatusCode.networkFailure,
      redirected: false
    })
  }

  requestFinished() {
    this.finishRequest()
  }

  // Scrolling

  performScroll() {
    if (!this.scrolled && !this.view.forceReloaded && !this.view.shouldPreserveScrollPosition(this)) {
      if (this.action == "restore") {
        this.scrollToRestoredPosition() || this.scrollToAnchor() || this.view.scrollToTop()
      } else {
        this.scrollToAnchor() || this.view.scrollToTop()
      }

      this.scrolled = true
    }
  }

  scrollToRestoredPosition() {
    const { scrollPosition } = this.restorationData
    if (scrollPosition) {
      this.view.scrollToPosition(scrollPosition)
      return true
    }
  }

  scrollToAnchor() {
    const anchor = getAnchor(this.location)
    if (anchor != null) {
      this.view.scrollToAnchor(anchor)
      return true
    }
  }

  // Instrumentation

  recordTimingMetric(metric: TimingMetric) {
    this.timingMetrics[metric] = new Date().getTime()
  }

  getTimingMetrics() {
    return { ...this.timingMetrics }
  }

  // Private

  hasPreloadedResponse() {
    return typeof this.response == "object"
  }

  shouldIssueRequest() {
    return this.willRender
  }

  async render(callback: () => void | Promise<void>) {
    this.cancelRender()
    await new Promise<void>((resolve) => {
      this.frame =
        document.visibilityState === "hidden" ? setTimeout(() => resolve(), 0) : requestAnimationFrame(() => resolve())
    })
    await callback()
    delete this.frame
  }

  async renderPageSnapshot(snapshot: PageSnapshot) {
    await this.viewTransitioner.renderChange(this.view.shouldTransitionTo(snapshot), async () => {
      await this.view.renderPage(snapshot, this.willRender, this)
      this.performScroll()
    })
  }

  cancelRender() {
    if (this.frame) {
      cancelAnimationFrame(this.frame)
      delete this.frame
    }
  }
}

function isSuccessful(statusCode: number) {
  return statusCode >= 200 && statusCode < 300
}
