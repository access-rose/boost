import { moveElementBefore } from "../util"
import type { PermanentElementMap } from "./snapshot"

export interface BardoDelegate {
  enteringBardo(currentPermanentElement: Element, newPermanentElement: Element): void
  leavingBardo(currentPermanentElement: Element): void
}

export class Bardo {
  readonly delegate: BardoDelegate
  readonly permanentElementMap: PermanentElementMap
  readonly #preserveConnection: boolean

  static async preservingPermanentElements(
    delegate: BardoDelegate,
    permanentElementMap: PermanentElementMap,
    callback: () => void | Promise<void>,
    preserveConnection = false
  ) {
    const bardo = new this(delegate, permanentElementMap, preserveConnection)
    bardo.enter()
    await callback()
    bardo.leave()
  }

  constructor(delegate: BardoDelegate, permanentElementMap: PermanentElementMap, preserveConnection = false) {
    this.delegate = delegate
    this.permanentElementMap = permanentElementMap
    // The moveBefore stash/restore path is specific to the placeholder-based
    // page/frame renderer. Streams manage permanence with their own delegate (no
    // placeholder), so they must opt out — otherwise the current element gets
    // stashed on <html> and never restored, leaving a duplicate.
    this.#preserveConnection = preserveConnection && typeof document.documentElement.moveBefore === "function"
  }

  enter() {
    for (const id in this.permanentElementMap) {
      const entry = this.permanentElementMap[id]
      if (!entry) continue

      const [currentPermanentElement, newPermanentElement] = entry
      this.delegate.enteringBardo(currentPermanentElement, newPermanentElement)
      this.replaceNewPermanentElementWithPlaceholder(newPermanentElement)

      if (this.#preserveConnection) {
        this.stashCurrentPermanentElement(currentPermanentElement)
      }
    }
  }

  leave() {
    for (const id in this.permanentElementMap) {
      const entry = this.permanentElementMap[id]
      if (!entry) continue

      const [currentPermanentElement] = entry

      if (this.#preserveConnection) {
        this.restorePermanentElementToPlaceholder(currentPermanentElement)
      } else {
        this.replaceCurrentPermanentElementWithClone(currentPermanentElement)
        this.replacePlaceholderWithPermanentElement(currentPermanentElement)
      }

      this.delegate.leavingBardo(currentPermanentElement)
    }
  }

  replaceNewPermanentElementWithPlaceholder(permanentElement: Element) {
    const placeholder = createPlaceholderForPermanentElement(permanentElement)
    permanentElement.replaceWith(placeholder)
  }

  // move the live element to <html>, which is not part
  // of the body being swapped, so it is never disconnected.
  stashCurrentPermanentElement(permanentElement: Element) {
    moveElementBefore(document.documentElement, permanentElement, null)
  }

  // move the still-connected live element from <html>
  // into the placeholder's slot in the new body, then drop the placeholder.
  restorePermanentElementToPlaceholder(permanentElement: Element) {
    const placeholder = this.getPlaceholderById(permanentElement.id)
    if (placeholder?.parentElement) {
      moveElementBefore(placeholder.parentElement, permanentElement, placeholder)
      placeholder.remove()
    }
  }

  replaceCurrentPermanentElementWithClone(permanentElement: Element) {
    const clone = permanentElement.cloneNode(true)
    permanentElement.replaceWith(clone)
  }

  replacePlaceholderWithPermanentElement(permanentElement: Element) {
    const placeholder = this.getPlaceholderById(permanentElement.id)
    placeholder?.replaceWith(permanentElement)
  }

  getPlaceholderById(id: string) {
    return this.placeholders.find((element) => element.content == id)
  }

  get placeholders(): HTMLMetaElement[] {
    return [...document.querySelectorAll<HTMLMetaElement>("meta[name=boost-permanent-placeholder][content]")]
  }
}

function createPlaceholderForPermanentElement(permanentElement: Element) {
  const element = document.createElement("meta")
  element.setAttribute("name", "boost-permanent-placeholder")
  element.setAttribute("content", permanentElement.id)
  return element
}
