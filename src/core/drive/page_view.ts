import { View } from "../view"
import type { ViewDelegate, ViewRenderOptions } from "../view"
import { ErrorRenderer } from "./error_renderer"
import { MorphingPageRenderer } from "./morphing_page_renderer"
import { PageRenderer } from "./page_renderer"
import { PageSnapshot } from "./page_snapshot"
import type { Visit } from "./visit"

export type PageViewRenderOptions = ViewRenderOptions<HTMLElement>

export type PageViewDelegate = ViewDelegate<PageSnapshot>

type PageViewRenderer = PageRenderer | ErrorRenderer

export class PageView extends View<HTMLElement, PageSnapshot, PageViewRenderer, PageViewDelegate> {
  lastRenderedLocation = new URL(location.href)
  forceReloaded = false

  shouldTransitionTo(newSnapshot: PageSnapshot) {
    return this.snapshot.prefersViewTransitions && newSnapshot.prefersViewTransitions
  }

  renderPage(snapshot: PageSnapshot, willRender = true, visit?: Visit) {
    const shouldMorphPage = this.isPageRefresh(visit) && (visit?.refresh?.method || this.snapshot.refreshMethod) === "morph"
    const rendererClass = shouldMorphPage ? MorphingPageRenderer : PageRenderer

    const renderer = new rendererClass(this.snapshot, snapshot, willRender)

    if (renderer.shouldRender) {
      visit?.changeHistory()
    } else {
      const reason = renderer.reloadReason
      if (reason && !this.delegate.viewAllowsReload(reason)) {
        renderer.reloadCanceled = true
        visit?.changeHistory()
      } else {
        this.forceReloaded = true
      }
    }

    return this.render(renderer)
  }

  renderError(snapshot: PageSnapshot, visit?: Visit) {
    visit?.changeHistory()
    const renderer = new ErrorRenderer(this.snapshot, snapshot)
    return this.render(renderer)
  }

  isPageRefresh(visit?: Visit) {
    return !visit || (this.lastRenderedLocation.pathname === visit.location.pathname && visit.action === "replace")
  }

  shouldPreserveScrollPosition(visit?: Visit) {
    return this.isPageRefresh(visit) && (visit?.refresh?.scroll || this.snapshot.refreshScroll) === "preserve"
  }

  get snapshot() {
    return PageSnapshot.fromElement(this.element)
  }
}
