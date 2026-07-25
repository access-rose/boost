import { FrameController } from "../core/frames/frame_controller"
import { FrameElement } from "./frame_element"
import { StreamElement } from "./stream_element"
import { StreamSourceElement } from "./stream_source_element"

FrameElement.delegateConstructor = FrameController

export * from "./frame_element"
export * from "./stream_element"
export * from "./stream_source_element"

if (customElements.get("boost-frame") === undefined) {
  customElements.define("boost-frame", FrameElement)
}

if (customElements.get("boost-stream") === undefined) {
  customElements.define("boost-stream", StreamElement)
}

if (customElements.get("boost-stream-source") === undefined) {
  customElements.define("boost-stream-source", StreamSourceElement)
}
