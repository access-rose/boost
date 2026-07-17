import { uuid } from "../../util"
import type { Position } from "../types"

export type HistoryDirection = "forward" | "back"

export interface HistoryDelegate {
  historyPoppedToLocationWithRestorationIdentifierAndDirection(
    location: URL,
    restorationIdentifier: string,
    direction: HistoryDirection
  ): void
  historyPoppedWithEmptyState(location: URL): void
}

type HistoryMethod = (this: typeof history, state: unknown, title: string, url?: string | null | undefined) => void

type TurboHistoryState = { restorationIdentifier: string; restorationIndex: number }

export type RestorationData = { scrollPosition?: Position }

export type RestorationDataMap = {
  [restorationIdentifier: string]: RestorationData
}

export class History {
  location!: URL
  restorationIdentifier = uuid()
  restorationData: RestorationDataMap = {}
  started = false
  currentIndex = 0

  declare readonly delegate: HistoryDelegate
  declare previousScrollRestoration?: ScrollRestoration

  constructor(delegate: HistoryDelegate) {
    this.delegate = delegate
  }

  start() {
    if (!this.started) {
      addEventListener("popstate", this.onPopState, false)
      this.currentIndex = history.state?.turbo?.restorationIndex || 0
      this.started = true
      this.replace(new URL(window.location.href))
    }
  }

  stop() {
    if (this.started) {
      removeEventListener("popstate", this.onPopState, false)
      this.started = false
    }
  }

  push(location: URL, restorationIdentifier?: string) {
    this.update(history.pushState, location, restorationIdentifier)
  }

  replace(location: URL, restorationIdentifier?: string) {
    this.update(history.replaceState, location, restorationIdentifier)
  }

  update(method: HistoryMethod, location: URL, restorationIdentifier = uuid()) {
    if (method === history.pushState) ++this.currentIndex

    const state = { turbo: { restorationIdentifier, restorationIndex: this.currentIndex } }
    method.call(history, state, "", location.href)
    this.location = location
    this.restorationIdentifier = restorationIdentifier
  }

  // Restoration data

  getRestorationDataForIdentifier(restorationIdentifier: string): RestorationData {
    return this.restorationData[restorationIdentifier] || {}
  }

  updateRestorationData(additionalData: RestorationData) {
    const { restorationIdentifier } = this
    const restorationData = this.restorationData[restorationIdentifier]
    this.restorationData[restorationIdentifier] = {
      ...restorationData,
      ...additionalData
    }
  }

  // Scroll restoration

  assumeControlOfScrollRestoration() {
    if (!this.previousScrollRestoration) {
      this.previousScrollRestoration = history.scrollRestoration ?? "auto"
      history.scrollRestoration = "manual"
    }
  }

  relinquishControlOfScrollRestoration() {
    if (this.previousScrollRestoration) {
      history.scrollRestoration = this.previousScrollRestoration
      delete this.previousScrollRestoration
    }
  }

  // Event handlers

  onPopState = (event: PopStateEvent) => {
    const { turbo }: { turbo?: TurboHistoryState } = event.state || {}
    this.location = new URL(window.location.href)

    if (turbo) {
      const { restorationIdentifier, restorationIndex } = turbo
      this.restorationIdentifier = restorationIdentifier
      const direction = restorationIndex > this.currentIndex ? "forward" : "back"
      this.delegate.historyPoppedToLocationWithRestorationIdentifierAndDirection(this.location, restorationIdentifier, direction)
      this.currentIndex = restorationIndex
    } else {
      this.currentIndex++
      this.delegate.historyPoppedWithEmptyState(this.location)
    }
  }
}
