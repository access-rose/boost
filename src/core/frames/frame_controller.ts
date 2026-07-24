import { FrameElement, FrameLoadingStyle } from "../../elements/frame_element"
import { FetchMethod, FetchRequest } from "../../http/fetch_request"
import { FetchResponse } from "../../http/fetch_response"
import { AppearanceObserver } from "../../observers/appearance_observer"
import {
  clearBusyState,
  dispatch,
  getAttribute,
  parseHTMLDocument,
  markAsBusy,
  uuid,
  getHistoryMethodForAction,
  getVisitAction
} from "../../util"
import { FormSubmission } from "../drive/form_submission"
import { Snapshot } from "../snapshot"
import { getAction, expandURL, urlsAreEqual, locationIsVisitable } from "../url"
import { FormSubmitObserver } from "../../observers/form_submit_observer"
import { FrameView } from "./frame_view"
import { LinkInterceptor } from "./link_interceptor"
import { FormLinkClickObserver } from "../../observers/form_link_click_observer"
import { FrameRenderer } from "./frame_renderer"
import { MorphingFrameRenderer } from "./morphing_frame_renderer"
import { session } from "../index"
import { StreamMessage } from "../streams/stream_message"
import { PageSnapshot } from "../drive/page_snapshot"
import type { Action } from "../types"
import type { AppearanceObserverDelegate } from "../../observers/appearance_observer"
import type { FetchRequestDelegate } from "../../http/fetch_request"
import type { FormSubmitObserverDelegate } from "../../observers/form_submit_observer"
import type { FormSubmissionDelegate } from "../drive/form_submission"
import type { FrameElementDelegate } from "../../elements/frame_element"
import type { FormLinkClickObserverDelegate } from "../../observers/form_link_click_observer"
import type { LinkInterceptorDelegate } from "./link_interceptor"
import type { ViewDelegate, ViewRenderOptions } from "../view"
import type { SubmitterElement } from "../config/forms"
import type { VisitOptions } from "../drive/visit"
import { TurboFrameMissingError } from "../errors"

export class FrameController
  implements
    AppearanceObserverDelegate<FrameElement>,
    FetchRequestDelegate,
    FormSubmitObserverDelegate,
    FormSubmissionDelegate,
    FrameElementDelegate,
    FormLinkClickObserverDelegate,
    LinkInterceptorDelegate,
    ViewDelegate<Snapshot<FrameElement>>
{
  fetchResponseLoaded = (_fetchResponse: FetchResponse) => Promise.resolve()
  #currentFetchRequest: FetchRequest | null = null
  #resolveVisitPromise = () => {}
  #connected = false
  #hasBeenLoaded = false
  #ignoredAttributes: Set<string> = new Set()
  #shouldMorphFrame = false
  action: Action | null = null

  declare readonly element: FrameElement
  declare readonly view: FrameView
  declare readonly appearanceObserver: AppearanceObserver<FrameElement>
  declare readonly formLinkClickObserver: FormLinkClickObserver
  declare readonly linkInterceptor: LinkInterceptor
  declare readonly formSubmitObserver: FormSubmitObserver
  declare readonly restorationIdentifier: string
  declare formSubmission?: FormSubmission
  declare previousFrameElement?: FrameElement
  declare currentNavigationElement?: Element

  constructor(element: FrameElement) {
    this.element = element
    this.view = new FrameView(this, this.element)
    this.appearanceObserver = new AppearanceObserver(this, this.element)
    this.formLinkClickObserver = new FormLinkClickObserver(this, this.element)
    this.linkInterceptor = new LinkInterceptor(this, this.element)
    this.restorationIdentifier = uuid()
    this.formSubmitObserver = new FormSubmitObserver(this, this.element)
  }

  // Frame delegate

  connect() {
    if (!this.#connected) {
      this.#connected = true
      if (this.loadingStyle == FrameLoadingStyle.lazy) {
        this.appearanceObserver.start()
      } else {
        this.#loadSourceURL()
      }
      this.formLinkClickObserver.start()
      this.linkInterceptor.start()
      this.formSubmitObserver.start()
    }
  }

  disconnect() {
    if (this.#connected) {
      this.#connected = false
      this.appearanceObserver.stop()
      this.formLinkClickObserver.stop()
      this.linkInterceptor.stop()
      this.formSubmitObserver.stop()

      if (!this.element.hasAttribute("recurse")) {
        this.#currentFetchRequest?.cancel()
      }
    }
  }

  disabledChanged() {
    if (this.disabled) {
      this.#currentFetchRequest?.cancel()
    } else if (this.loadingStyle == FrameLoadingStyle.eager) {
      this.#loadSourceURL()
    }
  }

  sourceURLChanged() {
    if (this.#isIgnoringChangesTo("src")) return

    if (!this.sourceURL) {
      this.#currentFetchRequest?.cancel()
    }

    if (this.element.isConnected) {
      this.complete = false
    }

    if (this.loadingStyle == FrameLoadingStyle.eager || this.#hasBeenLoaded) {
      this.#loadSourceURL()
    }
  }

  sourceURLReloaded() {
    const { refresh, src } = this.element

    this.#shouldMorphFrame = !!src && refresh === "morph"

    this.element.removeAttribute("complete")
    this.element.src = null
    this.element.src = src
    return this.element.loaded
  }

  loadingStyleChanged() {
    if (this.loadingStyle == FrameLoadingStyle.lazy) {
      this.appearanceObserver.start()
    } else {
      this.appearanceObserver.stop()
      this.#loadSourceURL()
    }
  }

  async #loadSourceURL() {
    if (this.enabled && this.isActive && !this.complete && this.sourceURL) {
      this.element.loaded = this.#visit(expandURL(this.sourceURL))
      this.appearanceObserver.stop()
      await this.element.loaded
      this.#hasBeenLoaded = true
    }
  }

  async loadResponse(fetchResponse: FetchResponse) {
    if (fetchResponse.redirected || (fetchResponse.succeeded && fetchResponse.isHTML)) {
      this.sourceURL = fetchResponse.response.url
    }

    try {
      const html = await fetchResponse.responseHTML
      if (html) {
        const document = parseHTMLDocument(html)
        const pageSnapshot = PageSnapshot.fromDocument(document)

        if (pageSnapshot.isVisitable) {
          await this.#loadFrameResponse(fetchResponse, document)
        } else {
          await this.#handleUnvisitableFrameResponse(fetchResponse)
        }
      }
    } finally {
      this.#shouldMorphFrame = false
      this.fetchResponseLoaded = () => Promise.resolve()
    }
  }

  // Appearance observer delegate

  elementAppearedInViewport(element: FrameElement) {
    this.proposeVisitIfNavigatedWithAction(element, getVisitAction(element))
    this.#loadSourceURL()
  }

  // Form link click observer delegate

  willSubmitFormLinkToLocation(link: Element) {
    return this.#shouldInterceptNavigation(link)
  }

  submittedFormLinkToLocation(link: Element, _location: URL, form: HTMLFormElement) {
    const frame = this.#findFrameElement(link)
    if (frame) form.setAttribute("data-turbo-frame", frame.id)
  }

  // Link interceptor delegate

  shouldInterceptLinkClick(element: Element, _location: string, _event: MouseEvent) {
    return this.#shouldInterceptNavigation(element)
  }

  linkClickIntercepted(element: Element, location: string) {
    this.#navigateFrame(element, location)
  }

  // Form submit observer delegate

  willSubmitForm(element: HTMLFormElement, submitter?: SubmitterElement) {
    return element.closest("turbo-frame") == this.element && this.#shouldInterceptNavigation(element, submitter)
  }

  formSubmitted(element: HTMLFormElement, submitter?: SubmitterElement) {
    if (this.formSubmission) {
      this.formSubmission.stop()
    }

    this.formSubmission = new FormSubmission(this, element, submitter)

    const { fetchRequest } = this.formSubmission
    const frame = this.#findFrameElement(element, submitter)

    this.prepareRequest(fetchRequest, frame)
    this.formSubmission.start()
  }

  // Fetch request delegate

  prepareRequest(request: FetchRequest, frame: { id: string } = this) {
    request.headers["Turbo-Frame"] = frame.id

    if (this.currentNavigationElement?.hasAttribute("data-turbo-stream")) {
      request.acceptResponseType(StreamMessage.contentType)
    }
  }

  requestStarted(_request: FetchRequest) {
    markAsBusy(this.element)
  }

  requestPreventedHandlingResponse(_request: FetchRequest, _response: FetchResponse) {
    this.#resolveVisitPromise()
  }

  async requestSucceededWithResponse(request: FetchRequest, response: FetchResponse) {
    await this.loadResponse(response)
    this.#resolveVisitPromise()
  }

  async requestFailedWithResponse(request: FetchRequest, response: FetchResponse) {
    await this.loadResponse(response)
    this.#resolveVisitPromise()
  }

  requestErrored(request: FetchRequest, error: unknown) {
    console.error(error)
    this.#resolveVisitPromise()
  }

  requestFinished(_request: FetchRequest) {
    clearBusyState(this.element)
  }

  // Form submission delegate

  formSubmissionStarted({ formElement }: FormSubmission) {
    markAsBusy(formElement, this.#findFrameElement(formElement))
  }

  formSubmissionSucceededWithResponse(formSubmission: FormSubmission, response: FetchResponse) {
    const frame = this.#findFrameElement(formSubmission.formElement, formSubmission.submitter)

    frame.delegate.proposeVisitIfNavigatedWithAction(frame, getVisitAction(formSubmission.submitter, formSubmission.formElement, frame))
    frame.delegate.loadResponse(response)
  }

  formSubmissionFailedWithResponse(formSubmission: FormSubmission, fetchResponse: FetchResponse) {
    this.element.delegate.loadResponse(fetchResponse)
  }

  formSubmissionErrored(formSubmission: FormSubmission, error: unknown) {
    console.error(error)
  }

  formSubmissionFinished({ formElement }: FormSubmission) {
    clearBusyState(formElement, this.#findFrameElement(formElement))
  }

  // View delegate

  allowsImmediateRender({ element: newFrame }: Snapshot<FrameElement>, options: ViewRenderOptions<FrameElement>) {
    const event = dispatch("turbo:before-frame-render", {
      target: this.element,
      detail: { newFrame, ...options },
      cancelable: true
    })

    const {
      defaultPrevented,
      detail: { render }
    } = event

    if (this.view.renderer && render) {
      this.view.renderer.renderElement = render
    }

    return !defaultPrevented
  }

  viewRenderedSnapshot(_snapshot: Snapshot<FrameElement>, _renderMethod: string) {}

  viewInvalidated() {}

  // Private

  async #loadFrameResponse(fetchResponse: FetchResponse, document: Document) {
    const newFrameElement = await this.extractForeignFrameElement(document.body)
    const rendererClass = this.#shouldMorphFrame ? MorphingFrameRenderer : FrameRenderer

    if (newFrameElement) {
      const snapshot = new Snapshot(newFrameElement)
      const renderer = new rendererClass(this.view.snapshot, snapshot, false)
      if (this.view.renderPromise) await this.view.renderPromise
      this.changeHistory()

      await this.view.render(renderer)
      this.complete = true
      session.frameRendered(fetchResponse, this.element)
      session.frameLoaded(this.element)
      await this.fetchResponseLoaded(fetchResponse)
    } else if (this.#willHandleFrameMissingFromResponse(fetchResponse)) {
      this.#handleFrameMissingFromResponse(fetchResponse)
    }
  }

  async #visit(url: URL) {
    const request = new FetchRequest(this, FetchMethod.get, url, new URLSearchParams(), this.element)

    this.#currentFetchRequest?.cancel()
    this.#currentFetchRequest = request

    return new Promise<void>((resolve) => {
      this.#resolveVisitPromise = () => {
        this.#resolveVisitPromise = () => {}
        this.#currentFetchRequest = null
        resolve()
      }
      request.perform()
    })
  }

  #navigateFrame(element: Element, url: string, submitter?: SubmitterElement) {
    const frame = this.#findFrameElement(element, submitter)

    frame.delegate.proposeVisitIfNavigatedWithAction(frame, getVisitAction(submitter, element, frame))

    this.#withCurrentNavigationElement(element, () => {
      frame.src = url
    })
  }

  proposeVisitIfNavigatedWithAction(frame: FrameElement, action: Action | null = null) {
    this.action = action

    if (this.action) {
      frame.delegate.fetchResponseLoaded = async (fetchResponse: FetchResponse) => {
        if (frame.src) {
          const { statusCode, redirected } = fetchResponse
          const responseHTML = await fetchResponse.responseHTML
          const response = { statusCode, redirected, responseHTML }
          const options: Partial<VisitOptions> = {
            response,
            willRender: false,
            updateHistory: false,
            restorationIdentifier: this.restorationIdentifier
          }

          if (this.action) options.action = this.action

          session.visit(frame.src, options)
        }
      }
    }
  }

  changeHistory() {
    if (this.action) {
      const method = getHistoryMethodForAction(this.action)
      session.history.update(method, expandURL(this.element.src || ""), this.restorationIdentifier)
    }
  }

  async #handleUnvisitableFrameResponse(fetchResponse: FetchResponse) {
    console.warn(
      `The response (${fetchResponse.statusCode}) from <turbo-frame id="${this.element.id}"> is performing a full page visit due to turbo-visit-control.`
    )

    await this.#visitResponse(fetchResponse.response)
  }

  #willHandleFrameMissingFromResponse(fetchResponse: FetchResponse) {
    this.element.setAttribute("complete", "")

    const response = fetchResponse.response
    const visit = async (url: URL | Response, options?: Partial<VisitOptions>) => {
      if (url instanceof Response) {
        this.#visitResponse(url)
      } else {
        session.visit(url, options)
      }
    }

    const event = dispatch("turbo:frame-missing", {
      target: this.element,
      detail: { response, visit },
      cancelable: true
    })

    return !event.defaultPrevented
  }

  #handleFrameMissingFromResponse(fetchResponse: FetchResponse) {
    this.view.missing()
    this.#throwFrameMissingError(fetchResponse)
  }

  #throwFrameMissingError(fetchResponse: FetchResponse) {
    const message = `The response (${fetchResponse.statusCode}) did not contain the expected <turbo-frame id="${this.element.id}"> and will be ignored. To perform a full page visit instead, set turbo-visit-control to reload.`
    throw new TurboFrameMissingError(message)
  }

  async #visitResponse(response: Response) {
    const wrapped = new FetchResponse(response)
    const responseHTML = await wrapped.responseHTML
    const { location, redirected, statusCode } = wrapped

    return session.visit(location, { response: { redirected, statusCode, responseHTML } })
  }

  #findFrameElement(element: Element, submitter?: SubmitterElement) {
    const id = getAttribute("data-turbo-frame", submitter, element) || this.element.getAttribute("target")
    const target = this.#getFrameElementById(id)

    return target instanceof FrameElement ? target : this.element
  }

  async extractForeignFrameElement(container: Element): Promise<FrameElement | null> {
    let element
    const id = CSS.escape(this.id)

    try {
      element = activateElement(container.querySelector(`turbo-frame#${id}`), this.sourceURL)
      if (element) {
        return element
      }

      element = activateElement(container.querySelector(`turbo-frame[src][recurse~=${id}]`), this.sourceURL)
      if (element) {
        await element.loaded
        return await this.extractForeignFrameElement(element)
      }
    } catch (error) {
      console.error(error)
      return new FrameElement()
    }

    return null
  }

  #formActionIsVisitable(form: HTMLFormElement, submitter?: SubmitterElement) {
    const action = getAction(form, submitter)

    return locationIsVisitable(expandURL(action), this.rootLocation)
  }

  #shouldInterceptNavigation(element: Element, submitter?: SubmitterElement) {
    const id = getAttribute("data-turbo-frame", submitter, element) || this.element.getAttribute("target")

    if (element instanceof HTMLFormElement && !this.#formActionIsVisitable(element, submitter)) {
      return false
    }

    if (!this.enabled || id == "_top") {
      return false
    }

    if (id) {
      const frameElement = this.#getFrameElementById(id)
      if (frameElement) {
        return !frameElement.disabled
      } else if (id == "_parent") {
        return false
      }
    }

    if (!session.elementIsNavigatable(element)) {
      return false
    }

    if (submitter && !session.elementIsNavigatable(submitter)) {
      return false
    }

    return true
  }

  // Computed properties

  get id() {
    return this.element.id
  }

  get disabled() {
    return this.element.disabled
  }

  get enabled() {
    return !this.disabled
  }

  get sourceURL() {
    if (this.element.src) {
      return this.element.src
    }
  }

  set sourceURL(sourceURL: string | undefined) {
    this.#ignoringChangesToAttribute("src", () => {
      this.element.src = sourceURL ?? null
    })
  }

  get loadingStyle() {
    return this.element.loading
  }

  get isLoading() {
    return this.formSubmission !== undefined || this.#resolveVisitPromise() !== undefined
  }

  get complete() {
    return this.element.hasAttribute("complete")
  }

  set complete(value: boolean) {
    if (value) {
      this.element.setAttribute("complete", "")
    } else {
      this.element.removeAttribute("complete")
    }
  }

  get isActive() {
    return this.element.isActive && this.#connected
  }

  get rootLocation() {
    const meta = this.element.ownerDocument.querySelector<HTMLMetaElement>(`meta[name="turbo-root"]`)
    const root = meta?.content ?? "/"
    return expandURL(root)
  }

  #isIgnoringChangesTo(attributeName: string) {
    return this.#ignoredAttributes.has(attributeName)
  }

  #ignoringChangesToAttribute(attributeName: string, callback: () => void) {
    this.#ignoredAttributes.add(attributeName)
    callback()
    this.#ignoredAttributes.delete(attributeName)
  }

  #withCurrentNavigationElement(element: Element, callback: () => void) {
    this.currentNavigationElement = element
    callback()
    delete this.currentNavigationElement
  }

  #getFrameElementById(id: string | null) {
    if (id != null) {
      const element = id === "_parent" ?
        this.element.parentElement?.closest("turbo-frame") :
        document.getElementById(id)
      if (element instanceof FrameElement) {
        return element
      }
    }
  }
}

function activateElement(element: FrameElement | null, currentURL?: string | null) {
  if (element) {
    const src = element.getAttribute("src")
    if (src != null && currentURL != null && urlsAreEqual(src, currentURL)) {
      throw new Error(`Matching <turbo-frame id="${element.id}"> element has a source URL which references itself`)
    }
    if (element.ownerDocument !== document) {
      element = document.importNode(element, true)
    }

    if (element instanceof FrameElement) {
      element.connectedCallback()
      element.disconnectedCallback()
      return element
    }
  }
}
