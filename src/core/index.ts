import { Session } from "./session"
import { PageRenderer } from "./drive/page_renderer"
import { PageSnapshot } from "./drive/page_snapshot"
import { FrameRenderer } from "./frames/frame_renderer"
import { fetch, recentRequests } from "../http/fetch"
import { config } from "./config"
import { expectedPermanentElements } from "./expected_permanent_elements"
import { MorphingPageRenderer } from "./drive/morphing_page_renderer"
import { MorphingFrameRenderer } from "./frames/morphing_frame_renderer"
import type { Adapter } from "./native/adapter"
import type { Locatable } from "./url"
import type { VisitOptions } from "./drive/visit"
import type { StreamSource } from "./types"
import type { StreamMessage } from "./streams/stream_message"
import type { ConfirmMethod, FormMode } from "./config/forms"
import type { FrameElement } from "../elements/frame_element"
import type { PageScript } from "./drive/page_scripts"

export type { PageScript, PageScriptContext, LeaveContext } from "./drive/page_scripts"

// Event types, so library consumers can type their listeners, e.g.
// `addEventListener("boost:render", (e: BoostRenderEvent) => …)`.
export type {
  TimingData,
  BoostBeforeRenderEvent,
  BoostBeforeVisitEvent,
  BoostClickEvent,
  BoostFrameLoadEvent,
  BoostFrameRenderEvent,
  BoostLoadEvent,
  BoostRenderEvent,
  BoostVisitEvent
} from "./session"

export { morphChildren, morphElements } from "./morphing"
export { PageRenderer, PageSnapshot, FrameRenderer, fetch, config, expectedPermanentElements }

const session = new Session(recentRequests)

// Rename `navigator` to avoid shadowing `window.navigator`
const { navigator: sessionNavigator } = session
export { session, sessionNavigator as navigator }

/**
 * Starts the main session.
 * This initialises any necessary observers such as those to monitor
 * link interactions.
 */
export function start() {
  session.start()
}

/**
 * Registers an adapter for the main session.
 *
 * @param adapter Adapter to register
 */
export function registerAdapter(adapter: Adapter) {
  session.registerAdapter(adapter)
}

/**
 * Registers a page-script lifecycle under one or more names. A page opts in by
 * adding to head a meta tag like:
 *
 * <meta name="boost-script" content="name">
 *
 * `connect` runs when the name first becomes active, `render` on every render while it stays active,
 * `beforeLeave` before every navigation (returning `false` cancels it), and
 * `disconnect` when the name leaves, just before the body is swapped.
 *
 * @param names Name, or names, the page declares via `<meta name="boost-script">`
 * @param script Lifecycle callbacks
 */
export function registerScript(names: string | string[], script: PageScript) {
  for (const name of Array.isArray(names) ? names : [names]) session.scripts.register(name, script)
}

/**
 * Marks one or more element IDs as expected to become permanent — preserved
 * across navigations like `data-boost-permanent` elements, but for nodes that
 * aren't in the server HTML yet (typically injected client-side by third-party
 * integrations).
 *
 * @param ids Element ID, or IDs
 */
export function addExpectedPermanentId(ids: string | string[]) {
  for (const id of Array.isArray(ids) ? ids : [ids]) expectedPermanentElements.add(id)
}

/**
 * Removes one or more IDs previously registered with `addExpectedPermanentId`.
 *
 * @param ids Element ID, or IDs, to stop preserving
 */
export function removeExpectedPermanentId(ids: string | string[]) {
  for (const id of Array.isArray(ids) ? ids : [ids]) expectedPermanentElements.remove(id)
}

/**
 * Performs an application visit to the given location.
 *
 * @param location Location to visit (a URL or path)
 * @param options Options to apply
 * @param options.action Type of history navigation to apply ("restore",
 * "replace" or "advance")
 * @param options.historyChanged Specifies whether the browser history has
 * already been changed for this visit or not
 * @param options.referrer Specifies the referrer of this visit such that
 * navigations to the same page will not result in a new history entry.
 * @param options.response Response of the specified location
 */
export function visit(location: Locatable, options?: Partial<VisitOptions>) {
  session.visit(location, options)
}

/**
 * Reloads the current page in place — re-fetches the current URL and re-renders
 * through Boost (not a browser reload). Unlike `session.refresh`, it performs no
 * same-URL / dedup / in-flight checks: it always reloads.
 *
 * By default it morphs the page (`method: "morph"`), preserving focus, scroll,
 * and unmanaged DOM. Pass `{ method: "replace" }` for a full `<body>` swap.
 *
 * @param options Options to apply
 * @param options.method "morph" (default) to morph the page, "replace" for a full swap
 * @param options.scroll "reset" (default) or "preserve" to keep the scroll position
 */
export function reload(options: { method?: "morph" | "replace"; scroll?: "reset" | "preserve" } = {}) {
  const { method = "morph", scroll } = options
  session.visit(window.location.href, { action: "replace", refresh: { method, scroll } })
}

/**
 * Connects a stream source to the main session.
 *
 * @param source Stream source to connect
 */
export function connectStreamSource(source: StreamSource) {
  session.connectStreamSource(source)
}

/**
 * Disconnects a stream source from the main session.
 *
 * @param source Stream source to disconnect
 */
export function disconnectStreamSource(source: StreamSource) {
  session.disconnectStreamSource(source)
}

/**
 * Renders a stream message to the main session by appending it to the
 * current document.
 *
 * @param message Message to render
 */
export function renderStreamMessage(message: StreamMessage | string) {
  session.renderStreamMessage(message)
}

/**
 * Sets the delay after which the progress bar will appear during navigation.
 *
 * The progress bar appears after 500ms by default.
 *
 * Note that this method has no effect when used with the iOS or Android
 * adapters.
 *
 * @param delay Time to delay in milliseconds
 */
export function setProgressBarDelay(delay: number) {
  console.warn(
    "Please replace `Boost.setProgressBarDelay(delay)` with `Boost.config.drive.progressBarDelay = delay`. The top-level function is deprecated and will be removed in a future version of Boost.`"
  )
  config.drive.progressBarDelay = delay
}

export function setConfirmMethod(confirmMethod: ConfirmMethod) {
  console.warn(
    "Please replace `Boost.setConfirmMethod(confirmMethod)` with `Boost.config.forms.confirm = confirmMethod`. The top-level function is deprecated and will be removed in a future version of Boost.`"
  )
  config.forms.confirm = confirmMethod
}

export function setFormMode(mode: FormMode) {
  console.warn(
    "Please replace `Boost.setFormMode(mode)` with `Boost.config.forms.mode = mode`. The top-level function is deprecated and will be removed in a future version of Boost.`"
  )
  config.forms.mode = mode
}

/**
 * Morph the state of the currentBody based on the attributes and contents of
 * the newBody. Morphing body elements may dispatch boost:morph,
 * boost:before-morph-element, boost:before-morph-attribute, and
 * boost:morph-element events.
 *
 * @param currentBody HTMLBodyElement destination of morphing changes
 * @param newBody HTMLBodyElement source of morphing changes
 */
export function morphBodyElements(currentBody: HTMLElement, newBody: HTMLElement) {
  MorphingPageRenderer.renderElement(currentBody, newBody)
}

/**
 * Morph the child elements of the currentFrame based on the child elements of
 * the newFrame. Morphing boost-frame elements may dispatch boost:before-frame-morph,
 * boost:before-morph-element, boost:before-morph-attribute, and
 * boost:morph-element events.
 *
 * @param currentFrame FrameElement destination of morphing children changes
 * @param newFrame FrameElement source of morphing children changes
 */
export function morphBoostFrameElements(currentFrame: FrameElement, newFrame: FrameElement) {
  MorphingFrameRenderer.renderElement(currentFrame, newFrame)
}
