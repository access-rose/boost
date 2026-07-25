import { Bardo } from "../bardo"
import { getPermanentElementById, queryPermanentElementsAll } from "../snapshot"
import { around, elementIsFocusable, nextRepaint, queryAutofocusableElement, uuid } from "../../util"
import type { BardoDelegate } from "../bardo"
import type { PermanentElementMap } from "../snapshot"
import type { StreamMessage } from "./stream_message"
import type { StreamElement } from "../../elements/stream_element"

export class StreamMessageRenderer implements BardoDelegate {
  render({ fragment }: StreamMessage) {
    Bardo.preservingPermanentElements(this, getPermanentElementMapForFragment(fragment), () => {
      withAutofocusFromFragment(fragment, () => {
        withPreservedFocus(() => {
          document.documentElement.appendChild(fragment)
        })
      })
    })
  }

  // Bardo delegate

  enteringBardo(currentPermanentElement: Element, newPermanentElement: Element) {
    newPermanentElement.replaceWith(currentPermanentElement.cloneNode(true))
  }

  leavingBardo() {}
}

function getPermanentElementMapForFragment(fragment: DocumentFragment) {
  const permanentElementsInDocument = queryPermanentElementsAll(document.documentElement)
  const permanentElementMap: PermanentElementMap = {}
  for (const permanentElementInDocument of permanentElementsInDocument) {
    const { id } = permanentElementInDocument

    for (const streamElement of fragment.querySelectorAll<StreamElement>("boost-stream")) {
      const elementInStream = getPermanentElementById(streamElement.templateElement.content, id)

      if (elementInStream) {
        permanentElementMap[id] = [permanentElementInDocument, elementInStream]
      }
    }
  }

  return permanentElementMap
}

async function withAutofocusFromFragment(fragment: DocumentFragment, callback: () => void) {
  const generatedID = `boost-stream-autofocus-${uuid()}`
  const boostStreams = fragment.querySelectorAll<StreamElement>("boost-stream")
  const elementWithAutofocus = firstAutofocusableElementInStreams(boostStreams)
  let willAutofocusId: string | null = null

  if (elementWithAutofocus) {
    if (elementWithAutofocus.id) {
      willAutofocusId = elementWithAutofocus.id
    } else {
      willAutofocusId = generatedID
    }

    elementWithAutofocus.id = willAutofocusId
  }

  callback()
  await nextRepaint()

  const hasNoActiveElement = document.activeElement == null || document.activeElement == document.body

  if (hasNoActiveElement && willAutofocusId) {
    const elementToAutofocus = document.getElementById(willAutofocusId)

    if (elementIsFocusable(elementToAutofocus)) {
      elementToAutofocus.focus()
    }
    if (elementToAutofocus && elementToAutofocus.id == generatedID) {
      elementToAutofocus.removeAttribute("id")
    }
  }
}

async function withPreservedFocus(callback: () => void) {
  const [activeElementBeforeRender, activeElementAfterRender] = await around(callback, () => document.activeElement)

  const restoreFocusTo = activeElementBeforeRender && activeElementBeforeRender.id

  if (restoreFocusTo) {
    const elementToFocus = document.getElementById(restoreFocusTo)

    if (elementIsFocusable(elementToFocus) && elementToFocus != activeElementAfterRender) {
      elementToFocus.focus()
    }
  }
}

function firstAutofocusableElementInStreams(nodeListOfStreamElements: NodeListOf<StreamElement>) {
  for (const streamElement of nodeListOfStreamElements) {
    const elementWithAutofocus = queryAutofocusableElement(streamElement.templateElement.content)

    if (elementWithAutofocus) return elementWithAutofocus
  }

  return null
}
