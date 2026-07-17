import { FetchResponse } from "./fetch_response"
import { expandURL } from "../core/url"
import { dispatch } from "../util"
import { fetch } from "./fetch"
import type { FrameElement } from "../elements/frame_element"
import type { Locatable } from "../core/url"

export type FetchRequestTarget = FrameElement | HTMLFormElement | HTMLAnchorElement | null

export type FetchRequestHeaders = Record<string, string>

export type FetchRequestBody = FormData | URLSearchParams

export type FetchRequestOptions = {
  credentials: RequestCredentials
  redirect: RequestRedirect
  method: string
  headers: FetchRequestHeaders
  body: FetchRequestBody | null
  signal: AbortSignal
  referrer?: string
  priority?: RequestPriority
}

export type TurboBeforeFetchRequestEvent = CustomEvent<{
  fetchOptions: FetchRequestOptions
  url: URL
  resume: (value?: unknown) => void
  fetchRequest?: FetchRequest
}>

export type TurboBeforeFetchResponseEvent = CustomEvent<{
  fetchResponse: FetchResponse
}>

export type TurboFetchRequestErrorEvent = CustomEvent<{
  request: FetchRequest
  error: unknown
}>

export interface FetchRequestDelegate {
  referrer?: URL

  prepareRequest(request: FetchRequest): void
  requestStarted(request: FetchRequest): void
  requestPreventedHandlingResponse(request: FetchRequest, response: FetchResponse): void
  requestSucceededWithResponse(request: FetchRequest, response: FetchResponse): void
  requestFailedWithResponse(request: FetchRequest, response: FetchResponse): void
  requestErrored(request: FetchRequest, error: unknown): void
  requestFinished(request: FetchRequest): void
}

export function fetchMethodFromString(method: string) {
  switch (method.toLowerCase()) {
    case "get":
      return FetchMethod.get
    case "post":
      return FetchMethod.post
    case "put":
      return FetchMethod.put
    case "patch":
      return FetchMethod.patch
    case "delete":
      return FetchMethod.delete
  }
}

export const FetchMethod = {
  get: "get",
  post: "post",
  put: "put",
  patch: "patch",
  delete: "delete"
} as const

export type FetchMethod = (typeof FetchMethod)[keyof typeof FetchMethod]

export function fetchEnctypeFromString(encoding: string) {
  switch (encoding.toLowerCase()) {
    case FetchEnctype.multipart:
      return FetchEnctype.multipart
    case FetchEnctype.plain:
      return FetchEnctype.plain
    default:
      return FetchEnctype.urlEncoded
  }
}

export const FetchEnctype = {
  urlEncoded: "application/x-www-form-urlencoded",
  multipart: "multipart/form-data",
  plain: "text/plain"
} as const

export type FetchEnctype = (typeof FetchEnctype)[keyof typeof FetchEnctype]

export class FetchRequest {
  abortController = new AbortController()
  #resolveRequestPromise: (value?: unknown) => void = (_value) => {}

  declare readonly delegate: FetchRequestDelegate
  declare url: URL
  declare readonly target: FetchRequestTarget
  declare readonly fetchOptions: FetchRequestOptions
  declare readonly enctype: FetchEnctype
  declare response: Promise<Response>

  constructor(delegate: FetchRequestDelegate, method: string, location: Locatable, requestBody: FetchRequestBody = new URLSearchParams(), target: FetchRequestTarget = null, enctype: FetchEnctype = FetchEnctype.urlEncoded) {
    const [url, body] = buildResourceAndBody(expandURL(location), method, requestBody, enctype)

    this.delegate = delegate
    this.url = url
    this.target = target
    this.fetchOptions = {
      credentials: "same-origin",
      redirect: "follow",
      method: method.toUpperCase(),
      headers: { ...this.defaultHeaders },
      body: body,
      signal: this.abortSignal,
      referrer: this.delegate.referrer?.href
    }
    this.enctype = enctype
  }

  get method() {
    return this.fetchOptions.method
  }

  set method(value: string) {
    const fetchBody = this.isSafe ? this.url.searchParams : this.fetchOptions.body || new FormData()
    const fetchMethod = fetchMethodFromString(value) || FetchMethod.get

    this.url.search = ""

    const [url, body] = buildResourceAndBody(this.url, fetchMethod, fetchBody, this.enctype)

    this.url = url
    this.fetchOptions.body = body
    this.fetchOptions.method = fetchMethod.toUpperCase()
  }

  get headers() {
    return this.fetchOptions.headers
  }

  set headers(value: FetchRequestHeaders) {
    this.fetchOptions.headers = value
  }

  get body() {
    if (this.isSafe) {
      return this.url.searchParams
    } else {
      return this.fetchOptions.body
    }
  }

  set body(value: FetchRequestBody | null) {
    this.fetchOptions.body = value
  }

  get location(): URL {
    return this.url
  }

  get params(): URLSearchParams {
    return this.url.searchParams
  }

  get entries() {
    return this.body ? Array.from(this.body.entries()) : []
  }

  cancel() {
    this.abortController.abort()
  }

  async perform(): Promise<FetchResponse | void> {
    const { fetchOptions } = this
    this.delegate.prepareRequest(this)
    const event = await this.#allowRequestToBeIntercepted(fetchOptions)
    try {
      this.delegate.requestStarted(this)

      if (event.detail.fetchRequest) {
        this.response = event.detail.fetchRequest.response
      } else {
        this.response = fetch(this.url.href, fetchOptions)
      }

      const response = await this.response
      return await this.receive(response)
    } catch (error) {
      if (!isAbortError(error)) {
        if (this.#willDelegateErrorHandling(error)) {
          this.delegate.requestErrored(this, error)
        }
        throw error
      }
    } finally {
      this.delegate.requestFinished(this)
    }
  }

  async receive(response: Response): Promise<FetchResponse> {
    const fetchResponse = new FetchResponse(response)
    const event = dispatch<TurboBeforeFetchResponseEvent>("turbo:before-fetch-response", {
      cancelable: true,
      detail: { fetchResponse },
      target: this.target
    })
    if (event.defaultPrevented) {
      this.delegate.requestPreventedHandlingResponse(this, fetchResponse)
    } else if (fetchResponse.succeeded) {
      this.delegate.requestSucceededWithResponse(this, fetchResponse)
    } else {
      this.delegate.requestFailedWithResponse(this, fetchResponse)
    }
    return fetchResponse
  }

  get defaultHeaders(): FetchRequestHeaders {
    return {
      Accept: "text/html, application/xhtml+xml"
    }
  }

  get isSafe() {
    return isSafe(this.method)
  }

  get abortSignal() {
    return this.abortController.signal
  }

  acceptResponseType(mimeType: string) {
    this.headers["Accept"] = [mimeType, this.headers["Accept"]].join(", ")
  }

  async #allowRequestToBeIntercepted(fetchOptions: FetchRequestOptions) {
    const requestInterception = new Promise((resolve) => (this.#resolveRequestPromise = resolve))
    const event = dispatch<TurboBeforeFetchRequestEvent>("turbo:before-fetch-request", {
      cancelable: true,
      detail: {
        fetchOptions,
        url: this.url,
        resume: this.#resolveRequestPromise
      },
      target: this.target
    })
    this.url = event.detail.url
    if (event.defaultPrevented) await requestInterception

    return event
  }

  #willDelegateErrorHandling(error: unknown) {
    const event = dispatch<TurboFetchRequestErrorEvent>("turbo:fetch-request-error", {
      target: this.target,
      cancelable: true,
      detail: { request: this, error: error }
    })

    return !event.defaultPrevented
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError"
}

export function isSafe(fetchMethod: string) {
  return fetchMethodFromString(fetchMethod) == FetchMethod.get
}

function buildResourceAndBody(resource: URL, method: string, requestBody: FetchRequestBody, enctype: FetchEnctype): [URL, FetchRequestBody | null] {
  const searchParams =
    Array.from(requestBody).length > 0 ? new URLSearchParams(entriesExcludingFiles(requestBody)) : resource.searchParams

  if (isSafe(method)) {
    return [mergeIntoURLSearchParams(resource, searchParams), null]
  } else if (enctype == FetchEnctype.urlEncoded) {
    return [resource, searchParams]
  } else {
    return [resource, requestBody]
  }
}

function entriesExcludingFiles(requestBody: FetchRequestBody): [string, string][] {
  const entries: [string, string][] = []

  for (const [name, value] of requestBody) {
    if (value instanceof File) continue
    else entries.push([name, value])
  }

  return entries
}

function mergeIntoURLSearchParams(url: URL, requestBody: FetchRequestBody) {
  const searchParams = new URLSearchParams(entriesExcludingFiles(requestBody))

  url.search = searchParams.toString()

  return url
}
