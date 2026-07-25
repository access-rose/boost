import "./polyfills"
import "./elements"
import "./script_warning"
import { StreamActions } from "./core/streams/stream_actions"

import * as Boost from "./core"

window.Boost = { ...Boost, StreamActions }
Boost.start()

export { StreamActions }
export * from "./core"
export * from "./elements"
export * from "./http"
