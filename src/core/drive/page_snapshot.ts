import { parseHTMLDocument } from "../../util"
import { Snapshot } from "../snapshot"
import { expandURL } from "../url"
import { HeadSnapshot } from "./head_snapshot"

export class PageSnapshot extends Snapshot<HTMLElement> {
  declare readonly documentElement: HTMLElement
  declare readonly headSnapshot: HeadSnapshot

  static fromHTMLString(html = "") {
    return this.fromDocument(parseHTMLDocument(html))
  }

  static fromElement(element: Element) {
    return this.fromDocument(element.ownerDocument)
  }

  static fromDocument({ documentElement, body, head }: Document) {
    return new this(documentElement, body, new HeadSnapshot(head))
  }

  constructor(documentElement: HTMLElement, body: HTMLElement, headSnapshot: HeadSnapshot) {
    super(body)
    this.documentElement = documentElement
    this.headSnapshot = headSnapshot
  }

  get lang() {
    return this.documentElement.getAttribute("lang")
  }

  get dir() {
    return this.documentElement.getAttribute("dir")
  }

  get headElement() {
    return this.headSnapshot.element
  }

  get rootLocation() {
    const root = this.getSetting("root") ?? "/"
    return expandURL(root)
  }

  get isVisitable() {
    return this.getSetting("visit-control") != "reload"
  }

  get prefersViewTransitions() {
    const viewTransitionEnabled = this.getSetting("view-transition") === "true" || this.headSnapshot.getMetaValue("view-transition") === "same-origin"
    return viewTransitionEnabled && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  }

  get refreshMethod() {
    return this.getSetting("refresh-method")
  }

  get refreshScroll() {
    return this.getSetting("refresh-scroll")
  }

  // Private

  getSetting(name: string) {
    return this.headSnapshot.getMetaValue(`turbo-${name}`)
  }
}
