import { activateScriptElement, nextRepaint } from "../../util"
import { Renderer } from "../renderer"
import type { FrameElement } from "../../elements/frame_element"

export class FrameRenderer extends Renderer<FrameElement> {
  static renderElement(currentElement: FrameElement, newElement: FrameElement) {
    const destinationRange = document.createRange()
    destinationRange.selectNodeContents(currentElement)
    destinationRange.deleteContents()

    const frameElement = newElement
    const sourceRange = frameElement.ownerDocument?.createRange()
    if (sourceRange) {
      sourceRange.selectNodeContents(frameElement)
      currentElement.appendChild(sourceRange.extractContents())
    }
  }

  get shouldRender() {
    return true
  }

  async render() {
    await nextRepaint()
    this.preservingPermanentElements(() => {
      this.loadFrameElement()
    })
    this.scrollFrameIntoView()
    await nextRepaint()
    this.focusFirstAutofocusableElement()
    await nextRepaint()
    this.activateScriptElements()
  }

  loadFrameElement() {
    this.renderElement(this.currentElement, this.newElement)
  }

  scrollFrameIntoView() {
    if (this.currentElement.autoscroll || this.newElement.autoscroll) {
      const element = this.currentElement.firstElementChild
      const block = readScrollLogicalPosition(this.currentElement.getAttribute("data-autoscroll-block"), "end")
      const behavior = readScrollBehavior(this.currentElement.getAttribute("data-autoscroll-behavior"), "auto")

      if (element) {
        element.scrollIntoView({ block, behavior })
        return true
      }
    }
    return false
  }

  activateScriptElements() {
    for (const inertScriptElement of this.newScriptElements) {
      const activatedScriptElement = activateScriptElement(inertScriptElement)
      inertScriptElement.replaceWith(activatedScriptElement)
    }
  }

  get newScriptElements() {
    return this.currentElement.querySelectorAll("script")
  }
}

function readScrollLogicalPosition(value: string | null, defaultValue: ScrollLogicalPosition): ScrollLogicalPosition {
  if (value == "end" || value == "start" || value == "center" || value == "nearest") {
    return value
  } else {
    return defaultValue
  }
}

function readScrollBehavior(value: string | null, defaultValue: ScrollBehavior): ScrollBehavior {
  if (value == "auto" || value == "smooth") {
    return value
  } else {
    return defaultValue
  }
}
