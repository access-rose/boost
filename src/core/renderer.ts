import { Bardo } from "./bardo"
import type { BardoDelegate } from "./bardo"
import type { Snapshot } from "./snapshot"
import type { ReloadReason } from "./native/browser_adapter"

type ResolvingFunctions<T = unknown> = {
  resolve(value: T | PromiseLike<T>): void
  reject(reason?: unknown): void
}

export type Render<E extends Element> = (currentElement: E, newElement: E) => void

export class Renderer<E extends Element, S extends Snapshot<E> = Snapshot<E>> implements BardoDelegate {
  #activeElement: Element | null = null

  declare ["constructor"]: { renderElement: Render<E> }

  declare readonly currentSnapshot: S
  declare readonly newSnapshot: S
  declare readonly willRender: boolean
  declare readonly promise: Promise<void>
  declare renderElement: Render<E>
  declare resolvingFunctions?: ResolvingFunctions<void>

  static renderElement(currentElement: Element, newElement: Element) {
    // Abstract method
  }

  constructor(currentSnapshot: S, newSnapshot: S, willRender = true) {
    this.currentSnapshot = currentSnapshot
    this.newSnapshot = newSnapshot
    this.willRender = willRender
    this.renderElement = this.constructor.renderElement
    this.promise = new Promise((resolve, reject) => (this.resolvingFunctions = { resolve, reject }))
  }

  get shouldRender() {
    return true
  }

  get shouldAutofocus() {
    return true
  }

  get reloadReason(): ReloadReason {
    return
  }

  prepareToRender() {
    return
  }

  render(): void | Promise<void> {
    // Abstract method
  }

  finishRendering() {
    if (this.resolvingFunctions) {
      this.resolvingFunctions.resolve()
      delete this.resolvingFunctions
    }
  }

  async preservingPermanentElements(callback: () => void | Promise<void>) {
    await Bardo.preservingPermanentElements(this, this.permanentElementMap, callback, true)
  }

  focusFirstAutofocusableElement() {
    if (this.shouldAutofocus) {
      const element = this.connectedSnapshot.firstAutofocusableElement
      if (element) {
        element.focus()
      }
    }
  }

  // Bardo delegate

  enteringBardo(currentPermanentElement: Element) {
    if (this.#activeElement) return

    if (currentPermanentElement.contains(this.currentSnapshot.activeElement)) {
      this.#activeElement = this.currentSnapshot.activeElement
    }
  }

  leavingBardo(currentPermanentElement: Element) {
    if (currentPermanentElement.contains(this.#activeElement) && this.#activeElement instanceof HTMLElement) {
      this.#activeElement.focus()

      this.#activeElement = null
    }
  }

  get connectedSnapshot(): S {
    return this.newSnapshot.isConnected ? this.newSnapshot : this.currentSnapshot
  }

  get currentElement(): E {
    return this.currentSnapshot.element
  }

  get newElement(): E {
    return this.newSnapshot.element
  }

  get permanentElementMap() {
    return this.currentSnapshot.getPermanentElementMapForSnapshot(this.newSnapshot)
  }

  get renderMethod() {
    return "replace"
  }
}
