import { LinkClickObserver } from "./link_click_observer"
import type { LinkClickObserverDelegate } from "./link_click_observer"
import { getVisitAction } from "../util"

export type FormLinkClickObserverDelegate = {
  willSubmitFormLinkToLocation(link: Element, location: URL, event: MouseEvent): boolean
  submittedFormLinkToLocation(link: Element, location: URL, form: HTMLFormElement): void
}

export class FormLinkClickObserver implements LinkClickObserverDelegate {
  readonly delegate: FormLinkClickObserverDelegate
  readonly linkInterceptor: LinkClickObserver

  constructor(delegate: FormLinkClickObserverDelegate, element: HTMLElement) {
    this.delegate = delegate
    this.linkInterceptor = new LinkClickObserver(this, element)
  }

  start() {
    this.linkInterceptor.start()
  }

  stop() {
    this.linkInterceptor.stop()
  }

  // Link click observer delegate

  willFollowLinkToLocation(link: Element, location: URL, originalEvent: MouseEvent) {
    return (
      this.delegate.willSubmitFormLinkToLocation(link, location, originalEvent) &&
      (link.hasAttribute("data-boost-method") || link.hasAttribute("data-boost-stream"))
    )
  }

  followedLinkToLocation(link: Element, location: URL) {
    const form = document.createElement("form")

    const type = "hidden"
    for (const [name, value] of location.searchParams) {
      form.append(Object.assign(document.createElement("input"), { type, name, value }))
    }

    const action = Object.assign(location, { search: "" })
    form.setAttribute("data-boost", "true")
    form.setAttribute("action", action.href)
    form.setAttribute("hidden", "")

    const method = link.getAttribute("data-boost-method")
    if (method) form.setAttribute("method", method)

    const boostFrame = link.getAttribute("data-boost-frame")
    if (boostFrame) form.setAttribute("data-boost-frame", boostFrame)

    const boostAction = getVisitAction(link)
    if (boostAction) form.setAttribute("data-boost-action", boostAction)

    const boostConfirm = link.getAttribute("data-boost-confirm")
    if (boostConfirm) form.setAttribute("data-boost-confirm", boostConfirm)

    const boostStream = link.hasAttribute("data-boost-stream")
    if (boostStream) form.setAttribute("data-boost-stream", "")

    this.delegate.submittedFormLinkToLocation(link, location, form)

    document.body.appendChild(form)
    form.addEventListener("boost:submit-end", () => form.remove(), { once: true })
    requestAnimationFrame(() => form.requestSubmit())
  }
}
