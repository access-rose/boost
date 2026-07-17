import { FormSubmitObserver } from "../../observers/form_submit_observer"
import { FrameElement } from "../../elements/frame_element"
import { LinkInterceptor } from "./link_interceptor"
import { expandURL, getAction, locationIsVisitable } from "../url"
import type { Session } from "../session"
import type { LinkInterceptorDelegate } from "./link_interceptor"
import type { FormSubmitObserverDelegate } from "../../observers/form_submit_observer"
import type { SubmitterElement } from "../config/forms"

export class FrameRedirector implements LinkInterceptorDelegate, FormSubmitObserverDelegate {
  readonly session: Session
  readonly element: Element
  readonly linkInterceptor: LinkInterceptor
  readonly formSubmitObserver: FormSubmitObserver

  constructor(session: Session, element: Element) {
    this.session = session
    this.element = element
    this.linkInterceptor = new LinkInterceptor(this, element)
    this.formSubmitObserver = new FormSubmitObserver(this, element)
  }

  start() {
    this.linkInterceptor.start()
    this.formSubmitObserver.start()
  }

  stop() {
    this.linkInterceptor.stop()
    this.formSubmitObserver.stop()
  }

  // Link interceptor delegate

  shouldInterceptLinkClick(element: Element, _location: string, _event: MouseEvent) {
    return this.#shouldRedirect(element)
  }

  linkClickIntercepted(element: Element, url: string, event: MouseEvent) {
    const frame = this.#findFrameElement(element)
    if (frame) {
      frame.delegate.linkClickIntercepted(element, url, event)
    }
  }

  // Form submit observer delegate

  willSubmitForm(element: HTMLFormElement, submitter?: SubmitterElement) {
    return (
      element.closest("turbo-frame") == null &&
      this.#shouldSubmit(element, submitter) &&
      this.#shouldRedirect(element, submitter)
    )
  }

  formSubmitted(element: HTMLFormElement, submitter?: SubmitterElement) {
    const frame = this.#findFrameElement(element, submitter)
    if (frame) {
      frame.delegate.formSubmitted(element, submitter)
    }
  }

  #shouldSubmit(form: HTMLFormElement, submitter?: SubmitterElement) {
    const action = getAction(form, submitter)
    const meta = this.element.ownerDocument.querySelector<HTMLMetaElement>(`meta[name="turbo-root"]`)
    const rootLocation = expandURL(meta?.content ?? "/")

    return this.#shouldRedirect(form, submitter) && locationIsVisitable(action, rootLocation)
  }

  #shouldRedirect(element: Element, submitter?: SubmitterElement) {
    const isNavigatable =
      element instanceof HTMLFormElement
        ? this.session.submissionIsNavigatable(element, submitter)
        : this.session.elementIsNavigatable(element)

    if (isNavigatable) {
      const frame = this.#findFrameElement(element, submitter)
      return frame ? frame != element.closest("turbo-frame") : false
    } else {
      return false
    }
  }

  #findFrameElement(element: Element, submitter?: SubmitterElement) {
    const id = submitter?.getAttribute("data-turbo-frame") || element.getAttribute("data-turbo-frame")
    if (id && id != "_top") {
      const frame = this.element.querySelector(`#${id}:not([disabled])`)
      if (frame instanceof FrameElement) {
        return frame
      }
    }
  }
}
