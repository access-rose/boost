interface Node {
  // https://github.com/Microsoft/TypeScript/issues/283
  cloneNode(deep?: boolean): this
}

interface DocumentEventMap {
  "turbo:before-fetch-request": import("./http/fetch_request").TurboBeforeFetchRequestEvent
  "turbo:before-fetch-response": import("./http/fetch_request").TurboBeforeFetchResponseEvent
  "turbo:click": import("./core/session").TurboClickEvent
  "turbo:before-visit": import("./core/session").TurboBeforeVisitEvent
}

interface Window {
  Turbo: typeof import("./core/index") & { StreamActions: typeof import("./core/streams/stream_actions").StreamActions }
}
