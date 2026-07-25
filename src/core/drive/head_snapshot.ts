import { elementIsStylesheet } from "../../util"
import { Snapshot } from "../snapshot"

type ElementDetailMap = { [outerHTML: string]: ElementDetails }

type ElementDetails = {
  type?: ElementType
  tracked: boolean
  elements: Element[]
}

type ElementType = "script" | "stylesheet"

export class HeadSnapshot extends Snapshot<HTMLHeadElement> {
  readonly detailsByOuterHTML = this.children
    .filter((element) => !elementIsNoscript(element))
    .map((element) => elementWithoutNonce(element))
    .reduce<ElementDetailMap>((result, element) => {
      const { outerHTML } = element
      const existing = result[outerHTML]
      const details: ElementDetails =
        outerHTML in result && existing
          ? existing
          : {
              type: elementType(element),
              tracked: elementIsTracked(element),
              elements: []
            }
      return {
        ...result,
        [outerHTML]: {
          ...details,
          elements: [...details.elements, element]
        }
      }
    }, {})

  get trackedElementSignature() {
    return Object.keys(this.detailsByOuterHTML)
      .filter((outerHTML) => this.detailsByOuterHTML[outerHTML]?.tracked)
      .join("")
  }

  getScriptElementsNotInSnapshot(snapshot: HeadSnapshot) {
    return this.getElementsMatchingTypeNotInSnapshot<HTMLScriptElement>("script", snapshot)
  }

  getStylesheetElementsNotInSnapshot(snapshot: HeadSnapshot) {
    return this.getElementsMatchingTypeNotInSnapshot<HTMLLinkElement | HTMLStyleElement>("stylesheet", snapshot)
  }

  getElementsMatchingTypeNotInSnapshot<T extends Element>(matchedType: ElementType, snapshot: HeadSnapshot): T[] {
    return Object.keys(this.detailsByOuterHTML)
      .filter((outerHTML) => !(outerHTML in snapshot.detailsByOuterHTML))
      .map((outerHTML) => this.detailsByOuterHTML[outerHTML])
      .filter((details) => details?.type == matchedType)
      .map((details) => details?.elements[0])
      .filter((element): element is T => element !== undefined)
  }

  get provisionalElements(): Element[] {
    return Object.keys(this.detailsByOuterHTML).reduce<Element[]>((result, outerHTML) => {
      const details = this.detailsByOuterHTML[outerHTML]
      if (!details) return result

      const { type, tracked, elements } = details
      if (type == null && !tracked) {
        return [...result, ...elements]
      } else if (elements.length > 1) {
        return [...result, ...elements.slice(1)]
      } else {
        return result
      }
    }, [])
  }

  getMetaValue(name: string) {
    const element = this.findMetaElementByName(name)
    return element ? element.getAttribute("content") : null
  }

  findMetaElementByName(name: string) {
    return Object.keys(this.detailsByOuterHTML).reduce<Element | undefined>((result, outerHTML) => {
      const element = this.detailsByOuterHTML[outerHTML]?.elements[0]
      return element && elementIsMetaElementWithName(element, name) ? element : result
    }, undefined)
  }
}

function elementType(element: Element) {
  if (elementIsScript(element)) {
    return "script"
  } else if (elementIsStylesheet(element)) {
    return "stylesheet"
  }
}

function elementIsTracked(element: Element) {
  return element.getAttribute("data-boost-track") == "reload"
}

function elementIsScript(element: Element) {
  const tagName = element.localName
  return tagName == "script"
}

function elementIsNoscript(element: Element) {
  const tagName = element.localName
  return tagName == "noscript"
}

function elementIsMetaElementWithName(element: Element, name: string) {
  const tagName = element.localName
  return tagName == "meta" && element.getAttribute("name") == name
}

function elementWithoutNonce(element: Element) {
  if (element.hasAttribute("nonce")) {
    element.setAttribute("nonce", "")
  }

  return element
}
