import { Idiomorph } from "idiomorph"
import type { IdiomorphCallbacks, IdiomorphConfig } from "idiomorph"
import { FrameElement } from "../elements/frame_element"
import { elementIsPermanent } from "./expected_permanent_elements"
import { dispatch } from "../util"
import { urlsAreEqual } from "./url"

export type MorphCallbacks = {
  beforeNodeMorphed?: (currentElement: Node, newElement?: Node) => boolean | undefined
}

export type MorphOptions = Omit<IdiomorphConfig, "callbacks"> & {
  callbacks?: MorphCallbacks
}

/**
 * Morph the state of the currentElement based on the attributes and contents of
 * the newElement. Morphing may dispatch boost:before-morph-element,
 * boost:before-morph-attribute, and boost:morph-element events.
 *
 * @param currentElement Element destination of morphing changes
 * @param newElement Element source of morphing changes
 */
export function morphElements(currentElement: Element, newElement: Node | NodeList, { callbacks, ...options }: MorphOptions = {}) {
  Idiomorph.morph(currentElement, newElement, {
    ...options,
    callbacks: new DefaultIdiomorphCallbacks(callbacks)
  })
}

/**
 * Morph the child elements of the currentElement based on the child elements of
 * the newElement. Morphing children may dispatch boost:before-morph-element,
 * boost:before-morph-attribute, and boost:morph-element events.
 *
 * @param currentElement Element destination of morphing children changes
 * @param newElement Element source of morphing children changes
 */
export function morphChildren(currentElement: Element, newElement: Element | DocumentFragment, options: MorphOptions = {}) {
  morphElements(currentElement, newElement.childNodes, {
    ...options,
    morphStyle: "innerHTML"
  })
}

export function shouldRefreshFrameWithMorphing(currentFrame: Node, newFrame: Node | null): currentFrame is FrameElement {
  return currentFrame instanceof FrameElement &&
    !!currentFrame.shouldReloadWithMorph && (!newFrame || areFramesCompatibleForRefreshing(currentFrame, newFrame)) &&
    !currentFrame.closest("[data-boost-permanent]")
}

function areFramesCompatibleForRefreshing(currentFrame: FrameElement, newFrame: Node) {
  // newFrame cannot yet be an instance of FrameElement because custom
  // elements don't get initialized until they're attached to the DOM, so
  // test its Element#nodeName instead
  return newFrame instanceof Element && newFrame.nodeName === "BOOST-FRAME" && currentFrame.id === newFrame.id &&
  (!newFrame.getAttribute("src") || urlsAreEqual(currentFrame.src ?? "", newFrame.getAttribute("src") ?? ""))
}

export function closestFrameReloadableWithMorphing(node: Node) {
  return node.parentElement?.closest("boost-frame[src][refresh=morph]")
}

class DefaultIdiomorphCallbacks implements IdiomorphCallbacks {
  #beforeNodeMorphed: (currentElement: Node, newElement?: Node) => boolean | undefined

  constructor({ beforeNodeMorphed }: MorphCallbacks = {}) {
    this.#beforeNodeMorphed = beforeNodeMorphed || (() => true)
  }

  beforeNodeAdded = (node: Node) => {
    return !(node instanceof Element && elementIsPermanent(node) && document.getElementById(node.id))
  }

  beforeNodeMorphed = (currentElement: Node, newElement?: Node) => {
    if (currentElement instanceof Element) {
      if (!elementIsPermanent(currentElement) && this.#beforeNodeMorphed(currentElement, newElement)) {
        const event = dispatch("boost:before-morph-element", {
          cancelable: true,
          target: currentElement,
          detail: { currentElement, newElement }
        })

        return !event.defaultPrevented
      } else {
        return false
      }
    }
  }

  beforeAttributeUpdated = (attributeName: string, target: Element, mutationType: "update" | "remove") => {
    const event = dispatch("boost:before-morph-attribute", {
      cancelable: true,
      target,
      detail: { attributeName, mutationType }
    })

    return !event.defaultPrevented
  }

  beforeNodeRemoved = (node: Node) => {
    return this.beforeNodeMorphed(node)
  }

  afterNodeMorphed = (currentElement: Node, newElement?: Node) => {
    if (currentElement instanceof Element) {
      dispatch("boost:morph-element", {
        target: currentElement,
        detail: { currentElement, newElement }
      })
    }
  }
}
