import { session } from "../"
import { morphElements, morphChildren } from "../morphing"
import type { StreamElement } from "../../elements/stream_element"

export type StreamActionFunction = (this: StreamElement) => void

export const StreamActions: Record<string, StreamActionFunction> = {
  after(this: StreamElement) {
    this.removeDuplicateTargetSiblings()
    this.targetElements.forEach((e) => e.parentElement?.insertBefore(this.templateContent, e.nextSibling))
  },

  append(this: StreamElement) {
    this.removeDuplicateTargetChildren()
    this.targetElements.forEach((e) => e.append(this.templateContent))
  },

  before(this: StreamElement) {
    this.removeDuplicateTargetSiblings()
    this.targetElements.forEach((e) => e.parentElement?.insertBefore(this.templateContent, e))
  },

  prepend(this: StreamElement) {
    this.removeDuplicateTargetChildren()
    this.targetElements.forEach((e) => e.prepend(this.templateContent))
  },

  remove(this: StreamElement) {
    this.targetElements.forEach((e) => e.remove())
  },

  replace(this: StreamElement) {
    const method = this.getAttribute("method")

    this.targetElements.forEach((targetElement) => {
      if (method === "morph") {
        morphElements(targetElement, this.templateContent)
      } else {
        targetElement.replaceWith(this.templateContent)
      }
    })
  },

  update(this: StreamElement) {
    const method = this.getAttribute("method")

    this.targetElements.forEach((targetElement) => {
      if (method === "morph") {
        morphChildren(targetElement, this.templateContent)
      } else {
        targetElement.innerHTML = ""
        targetElement.append(this.templateContent)
      }
    })
  },

  refresh(this: StreamElement) {
    const method = this.getAttribute("method")
    const requestId = this.requestId
    const scroll = this.getAttribute("scroll")

    session.refresh(this.baseURI, { method, requestId, scroll })
  }
}
