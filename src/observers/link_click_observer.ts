import { getLocationForLink } from "../core/url"
import { doesNotTargetIFrame, findLinkFromClickTarget } from "../util"

export interface LinkClickObserverDelegate {
  willFollowLinkToLocation(link: Element, location: URL, event: MouseEvent): boolean
  followedLinkToLocation(link: Element, location: URL): void
}

export class LinkClickObserver {
  readonly delegate: LinkClickObserverDelegate
  readonly eventTarget: EventTarget
  started = false

  constructor(delegate: LinkClickObserverDelegate, eventTarget: EventTarget) {
    this.delegate = delegate
    this.eventTarget = eventTarget
  }

  start() {
    if (!this.started) {
      this.eventTarget.addEventListener("click", this.clickCaptured, true)
      this.started = true
    }
  }

  stop() {
    if (this.started) {
      this.eventTarget.removeEventListener("click", this.clickCaptured, true)
      this.started = false
    }
  }

  clickCaptured = () => {
    this.eventTarget.removeEventListener("click", this.clickBubbled, false)
    this.eventTarget.addEventListener("click", this.clickBubbled, false)
  }

  clickBubbled = (event: Event) => {
    if (event instanceof MouseEvent && this.clickEventIsSignificant(event)) {
      const target = (event.composedPath && event.composedPath()[0]) || event.target
      const link = findLinkFromClickTarget(target)
      if (link && doesNotTargetIFrame(link.getAttribute("target"))) {
        const location = getLocationForLink(link)
        if (this.delegate.willFollowLinkToLocation(link, location, event)) {
          event.preventDefault()
          this.delegate.followedLinkToLocation(link, location)
        }
      }
    }
  }

  clickEventIsSignificant(event: MouseEvent) {
    return !(
      (event.target instanceof HTMLElement && event.target.isContentEditable) ||
      event.defaultPrevented ||
      event.which > 1 ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    )
  }
}
