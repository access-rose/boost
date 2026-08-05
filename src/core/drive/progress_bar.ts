import { unindent, getCspNonce } from "../../util"

export const ProgressBarID = "boost-progress-bar"

export class ProgressBar {
  static animationDuration = 300 /*ms*/

  static get defaultCSS() {
    return unindent`
      .boost-progress-bar {
        position: var(--boost-progress-bar-position, fixed);
        display: var(--boost-progress-bar-display, block);
        top: var(--boost-progress-bar-top, 0);
        left: var(--boost-progress-bar-left, 0);
        height: var(--boost-progress-bar-height, 3px);
        background-color: var(--boost-progress-bar-background-color, #0076ff);
        border-radius: var(--boost-progress-bar-border-radius, 0);
        box-shadow: var(--boost-progress-bar-box-shadow, none);
        z-index: var(--boost-progress-bar-z-index, 2147483647);
        transition:
          width ${ProgressBar.animationDuration}ms ease-out,
          opacity ${ProgressBar.animationDuration / 2}ms ${ProgressBar.animationDuration / 2}ms ease-in;
        transform: translate3d(0, 0, 0);
      }
    `
  }

  hiding = false
  value = 0
  visible = false

  declare stylesheetElement: HTMLStyleElement
  declare progressElement: HTMLDivElement
  declare trickleInterval?: number

  constructor() {
    this.stylesheetElement = this.createStylesheetElement()
    this.progressElement = this.createProgressElement()
    this.installStylesheetElement()
    this.setValue(0)
  }

  show() {
    if (!this.visible) {
      this.visible = true
      this.installProgressElement()
      this.startTrickling()
    }
  }

  hide() {
    if (this.visible && !this.hiding) {
      this.hiding = true
      this.fadeProgressElement(() => {
        this.uninstallProgressElement()
        this.stopTrickling()
        this.visible = false
        this.hiding = false
      })
    }
  }

  setValue(value: number) {
    this.value = value
    this.refresh()
  }

  // Private

  installStylesheetElement() {
    document.head.insertBefore(this.stylesheetElement, document.head.firstChild)
  }

  installProgressElement() {
    this.progressElement.style.width = "0"
    this.progressElement.style.opacity = "1"
    document.documentElement.insertBefore(this.progressElement, document.body)
    this.refresh()
  }

  fadeProgressElement(callback: () => void) {
    this.progressElement.style.opacity = "0"
    setTimeout(callback, ProgressBar.animationDuration * 1.5)
  }

  uninstallProgressElement() {
    if (this.progressElement.parentNode) {
      document.documentElement.removeChild(this.progressElement)
    }
  }

  startTrickling() {
    if (!this.trickleInterval) {
      this.trickleInterval = window.setInterval(this.trickle, ProgressBar.animationDuration)
    }
  }

  stopTrickling() {
    window.clearInterval(this.trickleInterval)
    delete this.trickleInterval
  }

  trickle = () => {
    this.setValue(this.value + Math.random() / 100)
  }

  refresh() {
    requestAnimationFrame(() => {
      this.progressElement.style.width = `${10 + this.value * 90}%`
    })
  }

  createStylesheetElement() {
    const element = document.createElement("style")
    element.type = "text/css"
    element.textContent = ProgressBar.defaultCSS
    const cspNonce = getCspNonce()
    if (cspNonce) {
      element.nonce = cspNonce
    }
    return element
  }

  createProgressElement() {
    const element = document.createElement("div")
    element.className = "boost-progress-bar"
    return element
  }
}
