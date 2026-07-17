import { FrameRenderer } from "./frame_renderer"
import { morphChildren, shouldRefreshFrameWithMorphing, closestFrameReloadableWithMorphing } from "../morphing"
import { dispatch } from "../../util"
import type { FrameElement } from "../../elements/frame_element"

export class MorphingFrameRenderer extends FrameRenderer {
  static renderElement(currentElement: FrameElement, newElement: FrameElement) {
    dispatch("turbo:before-frame-morph", {
      target: currentElement,
      detail: { currentElement, newElement }
    })

    morphChildren(currentElement, newElement, {
      callbacks: {
        beforeNodeMorphed: (node: Node, newNode?: Node) => {
          if (
            shouldRefreshFrameWithMorphing(node, newNode ?? null) &&
              closestFrameReloadableWithMorphing(node) === currentElement
          ) {
            node.reload()
            return false
          }
          return true
        }
      }
    })
  }

  async preservingPermanentElements(callback: () => void) {
    return await callback()
  }
}

