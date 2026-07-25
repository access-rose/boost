import { Snapshot } from "../snapshot"
import { View } from "../view"
import type { FrameElement } from "../../elements/frame_element"
import type { FrameRenderer } from "./frame_renderer"
import type { ViewDelegate, ViewRenderOptions } from "../view"

export type FrameViewRenderOptions = ViewRenderOptions<FrameElement>

export type FrameViewDelegate = ViewDelegate<Snapshot<FrameElement>>

export class FrameView extends View<FrameElement, Snapshot<FrameElement>, FrameRenderer, FrameViewDelegate> {
  missing() {
    this.element.innerHTML = `<strong class="boost-frame-error">Content missing</strong>`
  }

  get snapshot() {
    return new Snapshot(this.element)
  }
}
