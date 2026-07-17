export type Action = "advance" | "replace" | "restore"

export type Position = { x: number; y: number }

// Structurally typed rather than `EventSource` so that WebSocket, EventSource
// and test doubles all satisfy it.
export type StreamSource = {
  addEventListener(
    type: "message",
    listener: (event: MessageEvent) => void,
    options?: boolean | AddEventListenerOptions
  ): void
  removeEventListener(
    type: "message",
    listener: (event: MessageEvent) => void,
    options?: boolean | EventListenerOptions
  ): void
}
