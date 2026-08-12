import { PageRenderer } from "./page_renderer"
import { dispatch } from "../../util"
import { morphElements, shouldRefreshFrameWithMorphing, closestFrameReloadableWithMorphing } from "../morphing"

export class MorphingPageRenderer extends PageRenderer {
  static renderElement(currentElement: HTMLElement, newElement: HTMLElement) {
    morphElements(currentElement, newElement, {
      callbacks: {
        beforeNodeMorphed: (node: Node, newNode?: Node) => {
          if (
            shouldRefreshFrameWithMorphing(node, newNode ?? null) &&
              !closestFrameReloadableWithMorphing(node)
          ) {
            node.reload()
            return false
          }
          return true
        }
      }
    })

    dispatch("boost:morph", { detail: { currentElement, newElement } })
  }

  async preservingPermanentElements(callback: () => void) {
    return await callback()
  }

  relocateExpectedPermanentElements() {
    return
  }

  get renderMethod() {
    return "morph"
  }

  get shouldAutofocus() {
    return false
  }
}

