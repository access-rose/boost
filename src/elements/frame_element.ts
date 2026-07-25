import type { FetchResponse } from "../http/fetch_response"
import type { Action } from "../core/types"
import type { LinkInterceptorDelegate } from "../core/frames/link_interceptor"
import type { FormSubmitObserverDelegate } from "../observers/form_submit_observer"

export const FrameLoadingStyle = {
  eager: "eager",
  lazy: "lazy"
} as const

export type FrameLoadingStyle = (typeof FrameLoadingStyle)[keyof typeof FrameLoadingStyle]

export interface FrameElementDelegate extends LinkInterceptorDelegate, FormSubmitObserverDelegate {
  connect(): void
  disconnect(): void
  loadingStyleChanged(): void
  sourceURLChanged(): void
  sourceURLReloaded(): Promise<void>
  disabledChanged(): void
  loadResponse(response: FetchResponse): void
  proposeVisitIfNavigatedWithAction(frame: FrameElement, action?: Action | null): void
  fetchResponseLoaded: (fetchResponse: FetchResponse) => void
  isLoading: boolean
}

/**
 * Contains a fragment of HTML which is updated based on navigation within
 * it (e.g. via links or form submissions).
 *
 * @customElement boost-frame
 * @example
 *   <boost-frame id="messages">
 *     <a href="/messages/expanded">
 *       Show all expanded messages in this frame.
 *     </a>
 *
 *     <form action="/messages">
 *       Show response from this form within this frame.
 *     </form>
 *   </boost-frame>
 */
export class FrameElement extends HTMLElement {
  static delegateConstructor: new (element: FrameElement) => FrameElementDelegate

  loaded = Promise.resolve()

  declare readonly delegate: FrameElementDelegate

  static get observedAttributes() {
    return ["disabled", "loading", "src"]
  }

  constructor() {
    super()
    this.delegate = new FrameElement.delegateConstructor(this)
  }

  connectedCallback() {
    this.delegate.connect()
  }

  disconnectedCallback() {
    this.delegate.disconnect()
  }

  reload() {
    return this.delegate.sourceURLReloaded()
  }

  attributeChangedCallback(name: string) {
    if (name == "loading") {
      this.delegate.loadingStyleChanged()
    } else if (name == "src") {
      this.delegate.sourceURLChanged()
    } else if (name == "disabled") {
      this.delegate.disabledChanged()
    }
  }

  /**
   * Gets the URL to lazily load source HTML from
   */
  get src() {
    return this.getAttribute("src")
  }

  /**
   * Sets the URL to lazily load source HTML from
   */
  set src(value: string | null) {
    if (value) {
      this.setAttribute("src", value)
    } else {
      this.removeAttribute("src")
    }
  }

  /**
   * Gets the refresh mode for the frame.
   */
  get refresh() {
    return this.getAttribute("refresh")
  }

  /**
   * Sets the refresh mode for the frame.
   */
  set refresh(value: string | null) {
    if (value) {
      this.setAttribute("refresh", value)
    } else {
      this.removeAttribute("refresh")
    }
  }

  get shouldReloadWithMorph() {
    return this.src && this.refresh === "morph"
  }

  /**
   * Determines if the element is loading
   */
  get loading() {
    return frameLoadingStyleFromString(this.getAttribute("loading") || "")
  }

  /**
   * Sets the value of if the element is loading
   */
  set loading(value: FrameLoadingStyle | null) {
    if (value) {
      this.setAttribute("loading", value)
    } else {
      this.removeAttribute("loading")
    }
  }

  /**
   * Gets the disabled state of the frame.
   *
   * If disabled, no requests will be intercepted by the frame.
   */
  get disabled() {
    return this.hasAttribute("disabled")
  }

  /**
   * Sets the disabled state of the frame.
   *
   * If disabled, no requests will be intercepted by the frame.
   */
  set disabled(value: boolean) {
    if (value) {
      this.setAttribute("disabled", "")
    } else {
      this.removeAttribute("disabled")
    }
  }

  /**
   * Gets the autoscroll state of the frame.
   *
   * If true, the frame will be scrolled into view automatically on update.
   */
  get autoscroll() {
    return this.hasAttribute("autoscroll")
  }

  /**
   * Sets the autoscroll state of the frame.
   *
   * If true, the frame will be scrolled into view automatically on update.
   */
  set autoscroll(value: boolean) {
    if (value) {
      this.setAttribute("autoscroll", "")
    } else {
      this.removeAttribute("autoscroll")
    }
  }

  /**
   * Determines if the element has finished loading
   */
  get complete() {
    return !this.delegate.isLoading
  }

  /**
   * Gets the active state of the frame.
   *
   * If inactive, source changes will not be observed.
   */
  get isActive() {
    return this.ownerDocument === document
  }
}

function frameLoadingStyleFromString(style: string) {
  switch (style.toLowerCase()) {
    case "lazy":
      return FrameLoadingStyle.lazy
    default:
      return FrameLoadingStyle.eager
  }
}
