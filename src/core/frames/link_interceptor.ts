import { findLinkFromClickTarget } from "../../util"
import type { BoostClickEvent } from "../session"

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
    document.addEventListener("boost:click", this.linkClicked)
    document.addEventListener("boost:before-visit", this.willVisit)
  }

  stop() {
    this.element.removeEventListener("click", this.clickBubbled)
    document.removeEventListener("boost:click", this.linkClicked)
    document.removeEventListener("boost:before-visit", this.willVisit)
  }

  clickBubbled = (event: Event) => {
    if (this.clickEventIsSignificant(event)) {
      this.clickEvent = event
    } else {
      delete this.clickEvent
    }
  }

  linkClicked = (event: BoostClickEvent) => {
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

    return element instanceof Element && element.closest("boost-frame, html") == this.element
  }
}
