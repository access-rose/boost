import { getLocationForLink } from "../core/url"
import {
  dispatch,
  getMetaContent,
  findClosestRecursively,
  getLinkHrefString
} from "../util"

import { FetchMethod, FetchRequest } from "../http/fetch_request"
import type { FetchRequestDelegate, TurboBeforeFetchRequestEvent } from "../http/fetch_request"
import type { FetchResponse } from "../http/fetch_response"
import { prefetchCache, cacheTtl } from "../core/drive/prefetch_cache"

export interface LinkPrefetchObserverDelegate {
  canPrefetchRequestToLocation(link: Element, location: URL): boolean
}

export class LinkPrefetchObserver implements FetchRequestDelegate {
  readonly delegate: LinkPrefetchObserverDelegate
  readonly eventTarget: Document
  started = false
  #prefetchedLink: HTMLAnchorElement | null = null

  constructor(delegate: LinkPrefetchObserverDelegate, eventTarget: Document) {
    this.delegate = delegate
    this.eventTarget = eventTarget
  }

  start() {
    if (this.started) return

    if (this.eventTarget.readyState === "loading") {
      this.eventTarget.addEventListener("DOMContentLoaded", this.#enable, { once: true })
    } else {
      this.#enable()
    }
  }

  stop() {
    if (!this.started) return

    this.eventTarget.removeEventListener("mouseenter", this.#tryToPrefetchRequest, {
      capture: true
    })
    this.eventTarget.removeEventListener("mouseleave", this.#cancelRequestIfObsolete, {
      capture: true
    })

    this.eventTarget.removeEventListener("turbo:before-fetch-request", this.#tryToUsePrefetchedRequest, true)
    this.started = false
  }

  #enable = () => {
    this.eventTarget.addEventListener("mouseenter", this.#tryToPrefetchRequest, {
      capture: true,
      passive: true
    })
    this.eventTarget.addEventListener("mouseleave", this.#cancelRequestIfObsolete, {
      capture: true,
      passive: true
    })

    this.eventTarget.addEventListener("turbo:before-fetch-request", this.#tryToUsePrefetchedRequest, true)
    this.started = true
  }

  #tryToPrefetchRequest = (event: Event) => {
    if (getMetaContent("turbo-prefetch") === "false") return

    const target = event.target
    const isLink = target instanceof HTMLAnchorElement && target.matches("a[href]:not([target^=_]):not([download])")

    if (isLink && this.#isPrefetchable(target)) {
      const link = target
      const location = getLocationForLink(link)

      if (this.delegate.canPrefetchRequestToLocation(link, location)) {
        this.#prefetchedLink = link

        const fetchRequest = new FetchRequest(
          this,
          FetchMethod.get,
          location,
          new URLSearchParams(),
          target
        )

        fetchRequest.fetchOptions.priority = "low"

        prefetchCache.putLater(location, fetchRequest, this.#cacheTtl)
      }
    }
  }

  #cancelRequestIfObsolete = (event: Event) => {
    if (event.target === this.#prefetchedLink) this.#cancelPrefetchRequest()
  }

  #cancelPrefetchRequest = () => {
    prefetchCache.clear()
    this.#prefetchedLink = null
  }

  #tryToUsePrefetchedRequest = (event: TurboBeforeFetchRequestEvent) => {
    if (!(event.target instanceof Element && event.target.tagName === "FORM") && event.detail.fetchOptions.method === "GET") {
      const cached = prefetchCache.get(event.detail.url)

      if (cached) {
        // User clicked link, use cache response
        event.detail.fetchRequest = cached
      }

      prefetchCache.clear()
    }
  }

  prepareRequest(request: FetchRequest) {
    const link = request.target

    request.headers["X-Sec-Purpose"] = "prefetch"

    const turboFrame = link?.closest("turbo-frame")
    const turboFrameTarget = link?.getAttribute("data-turbo-frame") || turboFrame?.getAttribute("target") || turboFrame?.id

    if (turboFrameTarget && turboFrameTarget !== "_top") {
      request.headers["Turbo-Frame"] = turboFrameTarget
    }
  }

  // Fetch request interface

  requestSucceededWithResponse() {}

  requestStarted(fetchRequest: FetchRequest) {}

  requestErrored(fetchRequest: FetchRequest) {}

  requestFinished(fetchRequest: FetchRequest) {}

  requestPreventedHandlingResponse(fetchRequest: FetchRequest, fetchResponse: FetchResponse) {}

  requestFailedWithResponse(fetchRequest: FetchRequest, fetchResponse: FetchResponse) {}

  get #cacheTtl() {
    return Number(getMetaContent("turbo-prefetch-cache-time")) || cacheTtl
  }

  #isPrefetchable(link: HTMLAnchorElement) {
    const href = link.getAttribute("href")

    if (!href) return false

    if (unfetchableLink(link)) return false
    if (linkToTheSamePage(link)) return false
    if (linkOptsOut(link)) return false
    if (nonSafeLink(link)) return false
    if (eventPrevented(link)) return false

    return true
  }
}

const unfetchableLink = (link: HTMLAnchorElement) => {
  return link.origin !== document.location.origin || !["http:", "https:"].includes(link.protocol) || link.hasAttribute("target")
}

const linkToTheSamePage = (link: HTMLAnchorElement) => {
  return (link.pathname + link.search === document.location.pathname + document.location.search) || getLinkHrefString(link).startsWith("#")
}

const linkOptsOut = (link: HTMLAnchorElement) => {
  if (link.getAttribute("data-turbo-prefetch") === "false") return true
  if (link.getAttribute("data-turbo") === "false") return true

  const turboPrefetchParent = findClosestRecursively(link, "[data-turbo-prefetch]")
  if (turboPrefetchParent && turboPrefetchParent.getAttribute("data-turbo-prefetch") === "false") return true

  return false
}

const nonSafeLink = (link: HTMLAnchorElement) => {
  const turboMethod = link.getAttribute("data-turbo-method")
  if (turboMethod && turboMethod.toLowerCase() !== "get") return true

  if (isUJS(link)) return true
  if (link.hasAttribute("data-turbo-confirm")) return true
  if (link.hasAttribute("data-turbo-stream")) return true

  return false
}

const isUJS = (link: HTMLAnchorElement) => {
  return link.hasAttribute("data-remote") || link.hasAttribute("data-behavior") || link.hasAttribute("data-confirm") || link.hasAttribute("data-method")
}

const eventPrevented = (link: HTMLAnchorElement) => {
  const event = dispatch("turbo:before-prefetch", { target: link, cancelable: true })
  return event.defaultPrevented
}
