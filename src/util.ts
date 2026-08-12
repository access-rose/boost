import type { Action } from "./core/types"

export type DispatchOptions<T extends CustomEvent> = {
  target: (EventTarget & { isConnected?: boolean }) | null
  cancelable: boolean
  detail: T["detail"]
}

export function activateScriptElement(element: HTMLScriptElement) {
  if (element.getAttribute("data-boost-eval") == "false") {
    return element
  } else {
    const createdScriptElement = document.createElement("script")
    const cspNonce = getCspNonce()
    if (cspNonce) {
      createdScriptElement.nonce = cspNonce
    }
    createdScriptElement.textContent = element.textContent
    createdScriptElement.async = false
    copyElementAttributes(createdScriptElement, element)
    return createdScriptElement
  }
}

function copyElementAttributes(destinationElement: Element, sourceElement: Element) {
  for (const { name, value } of sourceElement.attributes) {
    destinationElement.setAttribute(name, value)
  }
}

// Inserts `node` into `parent` before `referenceNode`
export function moveElementBefore(parent: Element, node: Node, referenceNode: Node | null) {
  // prefer the atomic Element#moveBefore so an <iframe> in the moved subtree keeps its content instead of reloading.
  if (
    typeof parent.moveBefore === "function" &&
    parent.isConnected === node.isConnected &&
    node.ownerDocument === parent.ownerDocument
  ) {
    try {
      parent.moveBefore(node, referenceNode)
      return
    } catch {
      // moveBefore rejects some node relationships (e.g. an ancestor move); a
      // regular insert is always valid, so fall through to it.
    }
  }

  parent.insertBefore(node, referenceNode)
}

export function createDocumentFragment(html: string): DocumentFragment {
  const template = document.createElement("template")
  template.innerHTML = html
  return template.content
}

export function dispatch<T extends CustomEvent>(
  eventName: string,
  { target, cancelable, detail }: Partial<DispatchOptions<T>> = {}
) {
  const event = new CustomEvent<T["detail"]>(eventName, {
    cancelable,
    bubbles: true,
    composed: true,
    detail
  })

  if (target && target.isConnected) {
    target.dispatchEvent(event)
  } else {
    document.documentElement.dispatchEvent(event)
  }

  return event
}

export function cancelEvent(event: Event) {
  event.preventDefault()
  event.stopImmediatePropagation()
}

export function nextRepaint() {
  if (document.visibilityState === "hidden") {
    return nextEventLoopTick()
  } else {
    return nextAnimationFrame()
  }
}

export function nextAnimationFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

export function nextEventLoopTick() {
  return new Promise<void>((resolve) => setTimeout(() => resolve(), 0))
}

export function nextMicrotask() {
  return Promise.resolve()
}

export function parseHTMLDocument(html = "") {
  return new DOMParser().parseFromString(html, "text/html")
}

export function unindent(strings: TemplateStringsArray, ...values: (string | number)[]): string {
  const lines = interpolate(strings, values).replace(/^\n/, "").split("\n")
  const match = lines[0]?.match(/^\s+/)
  const indent = match ? match[0].length : 0
  return lines.map((line) => line.slice(indent)).join("\n")
}

function interpolate(strings: TemplateStringsArray, values: (string | number)[]) {
  return strings.reduce((result, string, i) => {
    const value = values[i] == undefined ? "" : values[i]
    return result + string + value
  }, "")
}

export function uuid() {
  return Array.from({ length: 36 })
    .map((_, i) => {
      if (i == 8 || i == 13 || i == 18 || i == 23) {
        return "-"
      } else if (i == 14) {
        return "4"
      } else if (i == 19) {
        return (Math.floor(Math.random() * 4) + 8).toString(16)
      } else {
        return Math.floor(Math.random() * 16).toString(16)
      }
    })
    .join("")
}

export function getAttribute(attributeName: string, ...elements: (Element | null | undefined)[]): string | null {
  for (const value of elements.map((element) => element?.getAttribute(attributeName))) {
    if (typeof value == "string") return value
  }

  return null
}

export function hasAttribute(attributeName: string, ...elements: (Element | null | undefined)[]): boolean {
  return elements.some((element) => element && element.hasAttribute(attributeName))
}

export function markAsBusy(...elements: Element[]) {
  for (const element of elements) {
    if (element.localName == "boost-frame") {
      element.setAttribute("busy", "")
    }
    element.setAttribute("aria-busy", "true")
  }
}

export function clearBusyState(...elements: Element[]) {
  for (const element of elements) {
    if (element.localName == "boost-frame") {
      element.removeAttribute("busy")
    }

    element.removeAttribute("aria-busy")
  }
}

export function waitForLoad(element: Element, timeoutInMilliseconds = 2000): Promise<void> {
  return new Promise((resolve) => {
    const onComplete = () => {
      element.removeEventListener("error", onComplete)
      element.removeEventListener("load", onComplete)
      resolve()
    }

    element.addEventListener("load", onComplete, { once: true })
    element.addEventListener("error", onComplete, { once: true })
    setTimeout(resolve, timeoutInMilliseconds)
  })
}

export function getHistoryMethodForAction(action: Action) {
  switch (action) {
    case "replace":
      return history.replaceState
    case "advance":
    case "restore":
      return history.pushState
  }
}

export function isAction(action: unknown): action is Action {
  return action == "advance" || action == "replace" || action == "restore"
}

export function getVisitAction(...elements: (Element | null | undefined)[]): Action | null {
  const action = getAttribute("data-boost-action", ...elements)

  return isAction(action) ? action : null
}

function getMetaElement(name: string): HTMLMetaElement | null {
  return document.querySelector(`meta[name="${name}"]`)
}

export function getMetaContent(name: string) {
  const element = getMetaElement(name)
  return element && element.content
}

export function getCspNonce() {
  const element = getMetaElement("csp-nonce")

  if (element) {
    const { nonce, content } = element
    return nonce == "" ? content : nonce
  }
}

export function findClosestRecursively<E extends Element>(
  element: EventTarget | null | undefined,
  selector: string
): E | undefined {
  if (element instanceof Element) {
    return (
      element.closest<E>(selector) || findClosestRecursively(element.assignedSlot || shadowHostOf(element), selector)
    )
  }
}

function shadowHostOf(element: Element) {
  const root = element.getRootNode()
  return root instanceof ShadowRoot ? root.host : undefined
}

export function elementIsStylesheet(element: Element & { relList?: DOMTokenList }) {
  return element.localName === "style" ||
    (element.localName === "link" && element.relList?.contains("stylesheet"))
}

export function elementIsFocusable(
  element: (Element & { focus?: () => void }) | null | undefined
): element is Element & { focus: () => void } {
  const inertDisabledOrHidden = "[inert], :disabled, [hidden], details:not([open]), dialog:not([open])"

  return !!element && element.closest(inertDisabledOrHidden) == null && typeof element.focus == "function"
}

export function queryAutofocusableElement(elementOrDocumentFragment: Element | DocumentFragment) {
  return Array.from(elementOrDocumentFragment.querySelectorAll("[autofocus]")).find(elementIsFocusable)
}

export async function around<T>(callback: () => void, reader: () => T): Promise<[T, T]> {
  const before = reader()

  callback()

  await nextAnimationFrame()

  const after = reader()

  return [before, after]
}

export function doesNotTargetIFrame(name: string | null) {
  if (name === "_blank") {
    return false
  } else if (name) {
    for (const element of document.getElementsByName(name)) {
      if (element instanceof HTMLIFrameElement) return false
    }

    return true
  } else {
    return true
  }
}

/**
 * Returns consistently the href attribute value as a string for both HTMLAnchorElement and SVGAElement.
 * HTMLAnchorElement href property returns an absolute URL if the attribute contains a valid relative URL.
 * SVGAElement exposes href as SVGAnimatedString which does not implement String methods.
 * getAttribute() will return the proper value of the attribute in both cases.
 */
export function getLinkHrefString(link: Element) {
  return link.getAttribute("href") ?? link.getAttribute("xlink:href") ?? ""
}

export function findLinkFromClickTarget(target: EventTarget | null | undefined) {
  const link = findClosestRecursively<HTMLAnchorElement | SVGAElement>(target, "a[href], a[xlink\\:href]")

  if (!link) return null
  if (getLinkHrefString(link).startsWith("#")) return null
  if (link.hasAttribute("download")) return null

  const linkTarget = link.getAttribute("target")
  if (linkTarget && linkTarget !== "_self") return null

  return link
}

export function debounce<T extends unknown[]>(this: unknown, fn: (...args: T) => void, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  return (...args: T) => {
    const callback = () => fn.apply(this, args)
    clearTimeout(timeoutId)
    timeoutId = setTimeout(callback, delay)
  }
}
