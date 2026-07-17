import { PageSnapshot } from "./page_snapshot"
import { FetchMethod, FetchRequest } from "../../http/fetch_request"
import type { FetchRequestDelegate } from "../../http/fetch_request"
import type { FetchResponse } from "../../http/fetch_response"
import type { SnapshotCache } from "./snapshot_cache"

export interface PreloaderDelegate {
  shouldPreloadLink(element: HTMLAnchorElement): boolean
}

export class Preloader implements FetchRequestDelegate {
  readonly delegate: PreloaderDelegate
  readonly snapshotCache: SnapshotCache
  selector = "a[data-turbo-preload]"

  constructor(delegate: PreloaderDelegate, snapshotCache: SnapshotCache) {
    this.delegate = delegate
    this.snapshotCache = snapshotCache
  }

  start() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", this.#preloadAll)
    } else {
      this.preloadOnLoadLinksForView(document.body)
    }
  }

  stop() {
    document.removeEventListener("DOMContentLoaded", this.#preloadAll)
  }

  preloadOnLoadLinksForView(element: Element) {
    for (const link of element.querySelectorAll<HTMLAnchorElement>(this.selector)) {
      if (this.delegate.shouldPreloadLink(link)) {
        this.preloadURL(link)
      }
    }
  }

  async preloadURL(link: HTMLAnchorElement) {
    const location = new URL(link.href)

    if (this.snapshotCache.has(location)) {
      return
    }

    const fetchRequest = new FetchRequest(this, FetchMethod.get, location, new URLSearchParams(), link)
    await fetchRequest.perform()
  }

  // Fetch request delegate

  prepareRequest(fetchRequest: FetchRequest) {
    fetchRequest.headers["X-Sec-Purpose"] = "prefetch"
  }

  async requestSucceededWithResponse(fetchRequest: FetchRequest, fetchResponse: FetchResponse) {
    try {
      const responseHTML = await fetchResponse.responseHTML
      const snapshot = PageSnapshot.fromHTMLString(responseHTML)

      this.snapshotCache.put(fetchRequest.url, snapshot)
    } catch (_) {
      // If we cannot preload that is ok!
    }
  }

  requestStarted(fetchRequest: FetchRequest) {}

  requestErrored(fetchRequest: FetchRequest) {}

  requestFinished(fetchRequest: FetchRequest) {}

  requestPreventedHandlingResponse(fetchRequest: FetchRequest, fetchResponse: FetchResponse) {}

  requestFailedWithResponse(fetchRequest: FetchRequest, fetchResponse: FetchResponse) {}

  #preloadAll = () => {
    this.preloadOnLoadLinksForView(document.body)
  }
}
