export class ExpectedPermanentElements {
  #ids = new Set<string>()

  add(id: string) {
    this.#ids.add(id)
  }

  remove(id: string) {
    this.#ids.delete(id)
  }

  has(id: string) {
    return this.activeIds().has(id)
  }

  activeIds() {
    const ids = new Set(this.#ids)
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="boost-expected-permanent-ids"]')) {
      for (const token of (meta.content || "").split(/\s+/)) {
        if (token) ids.add(token)
      }
    }
    return ids
  }
}

export const expectedPermanentElements = new ExpectedPermanentElements()

export function elementIsPermanent(element: Element) {
  return element.hasAttribute("data-boost-permanent") || (!!element.id && expectedPermanentElements.has(element.id))
}
