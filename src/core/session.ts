import { BrowserAdapter } from "./native/browser_adapter"
import { FormSubmitObserver } from "../observers/form_submit_observer"
import { FrameRedirector } from "./frames/frame_redirector"
import { History } from "./drive/history"
import { LinkClickObserver } from "../observers/link_click_observer"
import { FormLinkClickObserver } from "../observers/form_link_click_observer"
import { getAction, expandURL, locationIsVisitable } from "./url"
import { Navigator } from "./drive/navigator"
import { PageObserver } from "../observers/page_observer"
import { ScrollObserver } from "../observers/scroll_observer"
import { StreamMessage } from "./streams/stream_message"
import { StreamMessageRenderer } from "./streams/stream_message_renderer"
import { StreamObserver } from "../observers/stream_observer"
import { clearBusyState, dispatch, findClosestRecursively, getVisitAction, markAsBusy, debounce } from "../util"
import { PageView } from "./drive/page_view"
import { PageScripts } from "./drive/page_scripts"
import { FrameElement } from "../elements/frame_element"
import { config } from "./config"
import type { Action, Position, StreamSource } from "./types"
import type { Locatable } from "./url"
import type { Visit, VisitOptions } from "./drive/visit"
import type { HistoryDirection } from "./drive/history"
import type { VisitRefresh } from "./drive/visit"
import type { SubmitterElement } from "./config/forms"
import type { PageSnapshot } from "./drive/page_snapshot"
import type { ReloadReason } from "./native/browser_adapter"
import type { FetchResponse } from "../http/fetch_response"
import type { PageViewRenderOptions, PageViewDelegate } from "./drive/page_view"
import type { Adapter } from "./native/adapter"
import type { LimitedSet } from "./drive/limited_set"
import type { FormSubmitObserverDelegate } from "../observers/form_submit_observer"
import type { HistoryDelegate } from "./drive/history"
import type { FormLinkClickObserverDelegate } from "../observers/form_link_click_observer"
import type { LinkClickObserverDelegate } from "../observers/link_click_observer"
import type { NavigatorDelegate } from "./drive/navigator"
import type { PageObserverDelegate } from "../observers/page_observer"
import type { ScrollObserverDelegate } from "../observers/scroll_observer"
import type { StreamObserverDelegate } from "../observers/stream_observer"

export type TimingData = Record<string, unknown>

export type TurboBeforeRenderEvent = CustomEvent<{ newBody: HTMLElement } & PageViewRenderOptions>
export type TurboBeforeVisitEvent = CustomEvent<{ url: string }>
export type TurboClickEvent = CustomEvent<{ url: string; originalEvent: MouseEvent }>
export type TurboFrameLoadEvent = CustomEvent
export type TurboFrameRenderEvent = CustomEvent<{ fetchResponse: FetchResponse }>
export type TurboLoadEvent = CustomEvent<{ url: string; timing: TimingData }>
export type TurboRenderEvent = CustomEvent<{ renderMethod: string }>
export type TurboVisitEvent = CustomEvent<{ url: string; action: Action }>

export class Session
  implements
    FormSubmitObserverDelegate,
    HistoryDelegate,
    FormLinkClickObserverDelegate,
    LinkClickObserverDelegate,
    NavigatorDelegate,
    PageObserverDelegate,
    PageViewDelegate,
    ScrollObserverDelegate,
    StreamObserverDelegate
{
  navigator = new Navigator(this)
  history = new History(this)
  view = new PageView(this, document.documentElement)
  adapter: Adapter = new BrowserAdapter(this)

  pageObserver = new PageObserver(this)
  linkClickObserver = new LinkClickObserver(this, window)
  formSubmitObserver = new FormSubmitObserver(this, document)
  scrollObserver = new ScrollObserver(this)
  streamObserver = new StreamObserver(this)
  formLinkClickObserver = new FormLinkClickObserver(this, document.documentElement)
  frameRedirector = new FrameRedirector(this, document.documentElement)
  streamMessageRenderer = new StreamMessageRenderer()
  scripts = new PageScripts()

  enabled = true
  started = false
  #pageRefreshDebouncePeriod = 150

  declare readonly recentRequests: LimitedSet<string>
  declare debouncedRefresh: Session["refresh"]

  constructor(recentRequests: LimitedSet<string>) {
    this.recentRequests = recentRequests
    this.debouncedRefresh = this.refresh
    this.pageRefreshDebouncePeriod = this.pageRefreshDebouncePeriod
  }

  start() {
    if (!this.started) {
      this.pageObserver.start()
      this.formLinkClickObserver.start()
      this.linkClickObserver.start()
      this.formSubmitObserver.start()
      this.scrollObserver.start()
      this.streamObserver.start()
      this.frameRedirector.start()
      this.history.start()
      this.started = true
      this.enabled = true
    }
  }

  disable() {
    this.enabled = false
  }

  stop() {
    if (this.started) {
      this.pageObserver.stop()
      this.formLinkClickObserver.stop()
      this.linkClickObserver.stop()
      this.formSubmitObserver.stop()
      this.scrollObserver.stop()
      this.streamObserver.stop()
      this.frameRedirector.stop()
      this.history.stop()
      this.started = false
    }
  }

  registerAdapter(adapter: Adapter) {
    this.adapter = adapter
  }

  visit(location: Locatable, options: Partial<VisitOptions> = {}) {
    const frameElement = options.frame ? document.getElementById(options.frame) : null

    if (frameElement instanceof FrameElement) {
      const action = options.action || getVisitAction(frameElement)

      frameElement.delegate.proposeVisitIfNavigatedWithAction(frameElement, action)
      frameElement.src = location.toString()
    } else {
      this.navigator.proposeVisit(expandURL(location), options)
    }
  }

  refresh(url: string, options: string | (VisitRefresh & { requestId?: string | null }) = {}) {
    options = typeof options === "string" ? { requestId: options } : options

    const { method, requestId, scroll } = options
    const isRecentRequest = requestId && this.recentRequests.has(requestId)
    const isCurrentUrl = url === document.baseURI
    if (!isRecentRequest && !this.navigator.currentVisit && isCurrentUrl) {
      this.visit(url, { action: "replace", refresh: { method, scroll } })
    }
  }

  connectStreamSource(source: StreamSource) {
    this.streamObserver.connectStreamSource(source)
  }

  disconnectStreamSource(source: StreamSource) {
    this.streamObserver.disconnectStreamSource(source)
  }

  renderStreamMessage(message: StreamMessage | string) {
    this.streamMessageRenderer.render(StreamMessage.wrap(message))
  }

  setProgressBarDelay(delay: number) {
    console.warn(
      "Please replace `session.setProgressBarDelay(delay)` with `session.progressBarDelay = delay`. The function is deprecated and will be removed in a future version of Turbo.`"
    )

    this.progressBarDelay = delay
  }

  set progressBarDelay(delay) {
    config.drive.progressBarDelay = delay
  }

  get progressBarDelay() {
    return config.drive.progressBarDelay
  }

  set drive(value) {
    config.drive.enabled = value
  }

  get drive() {
    return config.drive.enabled
  }

  set formMode(value) {
    config.forms.mode = value
  }

  get formMode() {
    return config.forms.mode
  }

  get location() {
    return this.history.location
  }

  get restorationIdentifier() {
    return this.history.restorationIdentifier
  }

  get pageRefreshDebouncePeriod() {
    return this.#pageRefreshDebouncePeriod
  }

  set pageRefreshDebouncePeriod(value) {
    this.refresh = debounce(this.debouncedRefresh.bind(this), value)
    this.#pageRefreshDebouncePeriod = value
  }

  // History delegate

  historyPoppedToLocationWithRestorationIdentifierAndDirection(location: URL, restorationIdentifier: string, direction: HistoryDirection) {
    if (this.enabled) {
      this.navigator.startVisit(location, restorationIdentifier, {
        action: "restore",
        historyChanged: true,
        direction
      })
    } else {
      this.adapter.pageInvalidated({
        reason: "turbo_disabled"
      })
    }
  }

  historyPoppedWithEmptyState(location: URL) {
    this.history.replace(location)
    this.view.lastRenderedLocation = location
  }

  // Scroll observer delegate

  scrollPositionChanged(position: Position) {
    this.history.updateRestorationData({ scrollPosition: position })
  }

  // Form click observer delegate

  willSubmitFormLinkToLocation(link: Element, location: URL) {
    return this.elementIsNavigatable(link) && locationIsVisitable(location, this.snapshot.rootLocation)
  }

  submittedFormLinkToLocation() {}

  // Link click observer delegate

  willFollowLinkToLocation(link: Element, location: URL, event: MouseEvent) {
    return (
      this.elementIsNavigatable(link) &&
      locationIsVisitable(location, this.snapshot.rootLocation) &&
      this.applicationAllowsFollowingLinkToLocation(link, location, event)
    )
  }

  followedLinkToLocation(link: Element, location: URL) {
    const action = this.getActionForLink(link)
    const acceptsStreamResponse = link.hasAttribute("data-turbo-stream")

    this.visit(location.href, { action, acceptsStreamResponse })
  }

  // Navigator delegate

  allowsVisitingLocationWithAction(location: URL, action?: Action) {
    return this.applicationAllowsVisitingLocation(location)
  }

  visitProposedToLocation(location: URL, options: Partial<VisitOptions>) {
    extendURLWithDeprecatedProperties(location)
    this.adapter.visitProposedToLocation(location, options)
  }

  // Visit delegate

  visitStarted(visit: Visit) {
    if (!visit.acceptsStreamResponse) {
      markAsBusy(document.documentElement)
      this.view.markVisitDirection(visit.direction)
    }
    extendURLWithDeprecatedProperties(visit.location)
    this.notifyApplicationAfterVisitingLocation(visit.location, visit.action)
  }

  visitCompleted(visit: Visit) {
    this.view.unmarkVisitDirection()
    clearBusyState(document.documentElement)
    this.notifyApplicationAfterPageLoad(visit.getTimingMetrics())
  }

  // Form submit observer delegate

  willSubmitForm(form: HTMLFormElement, submitter?: SubmitterElement) {
    const action = getAction(form, submitter)

    return (
      this.submissionIsNavigatable(form, submitter) &&
      locationIsVisitable(expandURL(action), this.snapshot.rootLocation)
    )
  }

  formSubmitted(form: HTMLFormElement, submitter?: SubmitterElement) {
    this.navigator.submitForm(form, submitter)
  }

  // Page observer delegate

  pageBecameInteractive() {
    this.view.lastRenderedLocation = this.location
    this.scripts.connectAndRender()
    this.notifyApplicationAfterPageLoad()
  }

  pageLoaded() {
    this.history.assumeControlOfScrollRestoration()
  }

  pageWillUnload() {
    this.history.relinquishControlOfScrollRestoration()
  }

  // Stream observer delegate

  receivedMessageFromStream(message: StreamMessage) {
    this.renderStreamMessage(message)
  }

  // Page view delegate

  allowsImmediateRender({ element }: PageSnapshot, options: PageViewRenderOptions) {
    this.scripts.disconnectDeparting()
    const event = this.notifyApplicationBeforeRender(element, options)
    const {
      defaultPrevented,
      detail: { render }
    } = event

    if (this.view.renderer && render) {
      this.view.renderer.renderElement = render
    }

    return !defaultPrevented
  }

  viewRenderedSnapshot(_snapshot: PageSnapshot, renderMethod: string) {
    this.view.lastRenderedLocation = this.history.location
    this.scripts.connectAndRender()
    this.notifyApplicationAfterRender(renderMethod)
  }

  viewInvalidated(reason: ReloadReason) {
    this.adapter.pageInvalidated(reason)
  }

  // Frame element

  frameLoaded(frame: FrameElement) {
    this.notifyApplicationAfterFrameLoad(frame)
  }

  frameRendered(fetchResponse: FetchResponse, frame: FrameElement) {
    this.notifyApplicationAfterFrameRender(fetchResponse, frame)
  }

  // Application events

  applicationAllowsFollowingLinkToLocation(link: Element, location: URL, ev: MouseEvent) {
    const event = this.notifyApplicationAfterClickingLinkToLocation(link, location, ev)
    return !event.defaultPrevented
  }

  applicationAllowsVisitingLocation(location: URL) {
    const event = this.notifyApplicationBeforeVisitingLocation(location)
    return !event.defaultPrevented && this.scripts.allowLeaving(location)
  }

  notifyApplicationAfterClickingLinkToLocation(link: Element, location: URL, event: MouseEvent) {
    return dispatch("turbo:click", {
      target: link,
      detail: { url: location.href, originalEvent: event },
      cancelable: true
    })
  }

  notifyApplicationBeforeVisitingLocation(location: URL) {
    return dispatch("turbo:before-visit", {
      detail: { url: location.href },
      cancelable: true
    })
  }

  notifyApplicationAfterVisitingLocation(location: URL, action: Action) {
    return dispatch("turbo:visit", { detail: { url: location.href, action } })
  }

  notifyApplicationBeforeRender(newBody: HTMLElement, options: PageViewRenderOptions) {
    return dispatch("turbo:before-render", {
      detail: { newBody, ...options },
      cancelable: true
    })
  }

  notifyApplicationAfterRender(renderMethod: string) {
    return dispatch("turbo:render", { detail: { renderMethod } })
  }

  notifyApplicationAfterPageLoad(timing: TimingData = {}) {
    return dispatch("turbo:load", {
      detail: { url: this.location.href, timing }
    })
  }

  notifyApplicationAfterFrameLoad(frame: FrameElement) {
    return dispatch("turbo:frame-load", { target: frame })
  }

  notifyApplicationAfterFrameRender(fetchResponse: FetchResponse, frame: FrameElement) {
    return dispatch("turbo:frame-render", {
      detail: { fetchResponse },
      target: frame,
      cancelable: true
    })
  }

  // Helpers

  submissionIsNavigatable(form: HTMLFormElement, submitter?: SubmitterElement) {
    if (config.forms.mode == "off") {
      return false
    } else {
      const submitterIsNavigatable = submitter ? this.elementIsNavigatable(submitter) : true

      if (config.forms.mode == "optin") {
        return submitterIsNavigatable && form.closest('[data-turbo="true"]') != null
      } else {
        return submitterIsNavigatable && this.elementIsNavigatable(form)
      }
    }
  }

  elementIsNavigatable(element: Element) {
    const container = findClosestRecursively(element, "[data-turbo]")
    const withinFrame = findClosestRecursively(element, "turbo-frame")

    // Check if Drive is enabled on the session or we're within a Frame.
    if (config.drive.enabled || withinFrame) {
      // Element is navigatable by default, unless `data-turbo="false"`.
      if (container) {
        return container.getAttribute("data-turbo") != "false"
      } else {
        return true
      }
    } else {
      // Element isn't navigatable by default, unless `data-turbo="true"`.
      if (container) {
        return container.getAttribute("data-turbo") == "true"
      } else {
        return false
      }
    }
  }

  // Private

  getActionForLink(link: Element) {
    return getVisitAction(link) || "advance"
  }

  get snapshot() {
    return this.view.snapshot
  }
}

// Older versions of the Turbo Native adapters referenced the
// `Location#absoluteURL` property in their implementations of
// the `Adapter#visitProposedToLocation()` and `#visitStarted()`
// methods. The Location class has since been removed in favor
// of the DOM URL API, and accordingly all Adapter methods now
// receive URL objects.
//
// We alias #absoluteURL to #toString() here to avoid crashing
// older adapters which do not expect URL objects. We should
// consider removing this support at some point in the future.

function extendURLWithDeprecatedProperties(url: URL) {
  Object.defineProperties(url, deprecatedLocationPropertyDescriptors)
}

const deprecatedLocationPropertyDescriptors = {
  absoluteURL: {
    get() {
      return this.toString()
    }
  }
}
