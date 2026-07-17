import { activateScriptElement } from "../../util"
import { Renderer } from "../renderer"
import type { PageSnapshot } from "./page_snapshot"

export class ErrorRenderer extends Renderer<HTMLElement, PageSnapshot> {
  static renderElement(currentElement: HTMLElement, newElement: HTMLElement) {
    const { documentElement, body } = document

    documentElement.replaceChild(newElement, body)
  }

  async render() {
    this.replaceHeadAndBody()
    this.activateScriptElements()
  }

  replaceHeadAndBody() {
    const { documentElement, head } = document
    documentElement.replaceChild(this.newHead, head)
    this.renderElement(this.currentElement, this.newElement)
  }

  activateScriptElements() {
    for (const replaceableElement of this.scriptElements) {
      const parentNode = replaceableElement.parentNode
      if (parentNode) {
        const element = activateScriptElement(replaceableElement)
        parentNode.replaceChild(element, replaceableElement)
      }
    }
  }

  get newHead() {
    return this.newSnapshot.headSnapshot.element
  }

  get scriptElements() {
    return document.documentElement.querySelectorAll("script")
  }
}
