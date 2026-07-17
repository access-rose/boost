import { findLinkFromClickTarget } from "../../util"
import type { TurboClickEvent } from "../session"

export interface LinkInterceptorDelegate {
  shouldInterceptLinkClick(element: Element, url: string, originalEvent: MouseEvent): boolean
  linkClickIntercepted(element: Element, url: string, originalEvent: MouseEvent): void
}

export class LinkInterceptor {
  readonly delegate: LinkInterceptorDelegate
  readonly element: Element

  declare clickEvent?: Event

  constructor(delegate: LinkInterceptorDelegate, element: Element) {
    this.delegate = delegate
    this.element = element
  }

  start() {
    this.element.addEventListener("click", this.clickBubbled)
    document.addEventListener("turbo:click", this.linkClicked)
    document.addEventListener("turbo:before-visit", this.willVisit)
  }

  stop() {
    this.element.removeEventListener("click", this.clickBubbled)
    document.removeEventListener("turbo:click", this.linkClicked)
    document.removeEventListener("turbo:before-visit", this.willVisit)
  }

  clickBubbled = (event: Event) => {
    if (this.clickEventIsSignificant(event)) {
      this.clickEvent = event
    } else {
      delete this.clickEvent
    }
  }

  linkClicked = (event: TurboClickEvent) => {
    if (this.clickEvent && this.clickEventIsSignificant(event) && event.target instanceof Element) {
      if (this.delegate.shouldInterceptLinkClick(event.target, event.detail.url, event.detail.originalEvent)) {
        this.clickEvent.preventDefault()
        event.preventDefault()
        this.delegate.linkClickIntercepted(event.target, event.detail.url, event.detail.originalEvent)
      }
    }
    delete this.clickEvent
  }

  willVisit = (_event: Event) => {
    delete this.clickEvent
  }

  clickEventIsSignificant(event: Event) {
    const target = event.composed ? (event.target instanceof Element ? event.target.parentElement : undefined) : event.target
    const element = findLinkFromClickTarget(target) || target

    return element instanceof Element && element.closest("turbo-frame, html") == this.element
  }
}
