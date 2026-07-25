interface Node {
  // https://github.com/Microsoft/TypeScript/issues/283
  cloneNode(deep?: boolean): this
}

interface DocumentEventMap {
  "boost:before-fetch-request": import("./http/fetch_request").BoostBeforeFetchRequestEvent
  "boost:before-fetch-response": import("./http/fetch_request").BoostBeforeFetchResponseEvent
  "boost:click": import("./core/session").BoostClickEvent
  "boost:before-visit": import("./core/session").BoostBeforeVisitEvent
}

interface Window {
  Boost: typeof import("./core/index") & { StreamActions: typeof import("./core/streams/stream_actions").StreamActions }
}
