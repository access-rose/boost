import { getAnchor } from "./url"
import type { Renderer, Render } from "./renderer"
import type { Snapshot } from "./snapshot"
import type { Position } from "./types"
import type { ReloadReason } from "./native/browser_adapter"

export interface ViewRenderOptions<E extends Element> {
  resume: (value?: unknown) => void
  render: Render<E>
  renderMethod: string
}

export interface ViewDelegate<E extends Element, S extends Snapshot<Element>> {
  allowsImmediateRender(snapshot: S, options: ViewRenderOptions<S["element"]>): boolean
  preloadOnLoadLinksForView(element: E): void
  viewRenderedSnapshot(snapshot: S, isPreview: boolean, renderMethod: string): void
  viewInvalidated(reason: ReloadReason): void
}

export abstract class View<
  E extends Element,
  S extends Snapshot<Element> = Snapshot<E>,
  R extends Renderer<S["element"], S> = Renderer<S["element"], S>,
  D extends ViewDelegate<E, S> = ViewDelegate<E, S>
> {
  #resolveRenderPromise: (value: void | PromiseLike<void>) => void = (_value) => {}
  #resolveInterceptionPromise: (value?: unknown) => void = (_value) => {}

  readonly delegate: D
  readonly element: E

  abstract readonly snapshot: S

  declare renderer?: R
  declare renderPromise?: Promise<void>

  constructor(delegate: D, element: E) {
    this.delegate = delegate
    this.element = element
  }

  // Scrolling

  scrollToAnchor(anchor: string | undefined) {
    const element = this.snapshot.getElementForAnchor(anchor)
    if (element) {
      this.focusElement(element)
      this.scrollToElement(element)
    } else {
      this.scrollToPosition({ x: 0, y: 0 })
    }
  }

  scrollToAnchorFromLocation(location: URL) {
    this.scrollToAnchor(getAnchor(location))
  }

  scrollToElement(element: Element) {
    element.scrollIntoView()
  }

  focusElement(element: Element) {
    if (element instanceof HTMLElement) {
      if (element.hasAttribute("tabindex")) {
        element.focus()
      } else {
        element.setAttribute("tabindex", "-1")
        element.focus()
        element.removeAttribute("tabindex")
      }
    }
  }

  scrollToPosition({ x, y }: Position) {
    this.scrollRoot.scrollTo(x, y)
  }

  scrollToTop() {
    this.scrollToPosition({ x: 0, y: 0 })
  }

  get scrollRoot(): { scrollTo(x: number, y: number): void } {
    return window
  }

  // Rendering

  async render(renderer: R) {
    const { isPreview, shouldRender, willRender, newSnapshot: snapshot } = renderer

    // A workaround to ignore tracked element mismatch reloads when performing
    // a promoted Visit from a frame navigation
    const shouldInvalidate = willRender

    if (shouldRender) {
      try {
        this.renderPromise = new Promise<void>((resolve) => (this.#resolveRenderPromise = resolve))
        this.renderer = renderer
        await this.prepareToRenderSnapshot(renderer)

        const renderInterception = new Promise((resolve) => (this.#resolveInterceptionPromise = resolve))
        const options = { resume: this.#resolveInterceptionPromise, render: this.renderer.renderElement, renderMethod: this.renderer.renderMethod }
        const immediateRender = this.delegate.allowsImmediateRender(snapshot, options)
        if (!immediateRender) await renderInterception

        await this.renderSnapshot(renderer)
        this.delegate.viewRenderedSnapshot(snapshot, isPreview, this.renderer.renderMethod)
        this.delegate.preloadOnLoadLinksForView(this.element)
        this.finishRenderingSnapshot(renderer)
      } finally {
        delete this.renderer
        this.#resolveRenderPromise(undefined)
        delete this.renderPromise
      }
    } else if (shouldInvalidate) {
      this.invalidate(renderer.reloadReason)
    }
  }

  invalidate(reason: ReloadReason) {
    this.delegate.viewInvalidated(reason)
  }

  async prepareToRenderSnapshot(renderer: R) {
    this.markAsPreview(renderer.isPreview)
    await renderer.prepareToRender()
  }

  markAsPreview(isPreview: boolean) {
    if (isPreview) {
      this.element.setAttribute("data-turbo-preview", "")
    } else {
      this.element.removeAttribute("data-turbo-preview")
    }
  }

  markVisitDirection(direction: string) {
    this.element.setAttribute("data-turbo-visit-direction", direction)
  }

  unmarkVisitDirection() {
    this.element.removeAttribute("data-turbo-visit-direction")
  }

  async renderSnapshot(renderer: R) {
    await renderer.render()
  }

  finishRenderingSnapshot(renderer: R) {
    renderer.finishRendering()
  }
}
