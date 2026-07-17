import { doesNotTargetIFrame } from "../util"
import type { SubmitterElement } from "../core/config/forms"

export interface FormSubmitObserverDelegate {
  willSubmitForm(form: HTMLFormElement, submitter?: SubmitterElement): boolean
  formSubmitted(form: HTMLFormElement, submitter?: SubmitterElement): void
}

export class FormSubmitObserver {
  readonly delegate: FormSubmitObserverDelegate
  readonly eventTarget: EventTarget
  started = false

  constructor(delegate: FormSubmitObserverDelegate, eventTarget: EventTarget) {
    this.delegate = delegate
    this.eventTarget = eventTarget
  }

  start() {
    if (!this.started) {
      this.eventTarget.addEventListener("submit", this.submitCaptured, true)
      this.started = true
    }
  }

  stop() {
    if (this.started) {
      this.eventTarget.removeEventListener("submit", this.submitCaptured, true)
      this.started = false
    }
  }

  submitCaptured = () => {
    this.eventTarget.removeEventListener("submit", this.submitBubbled, false)
    this.eventTarget.addEventListener("submit", this.submitBubbled, false)
  }

  submitBubbled = (event: Event & { submitter?: SubmitterElement | null }) => {
    if (!event.defaultPrevented) {
      const form = event.target instanceof HTMLFormElement ? event.target : undefined
      const submitter = event.submitter || undefined

      if (
        form &&
        submissionDoesNotDismissDialog(form, submitter) &&
        submissionDoesNotTargetIFrame(form, submitter) &&
        this.delegate.willSubmitForm(form, submitter)
      ) {
        event.preventDefault()
        event.stopImmediatePropagation()
        this.delegate.formSubmitted(form, submitter)
      }
    }
  }
}

function submissionDoesNotDismissDialog(form: HTMLFormElement, submitter?: SubmitterElement) {
  const method = submitter?.getAttribute("formmethod") || form.getAttribute("method")

  return method != "dialog"
}

function submissionDoesNotTargetIFrame(form: HTMLFormElement, submitter?: SubmitterElement) {
  const target = submitter?.getAttribute("formtarget") || form.getAttribute("target")

  return doesNotTargetIFrame(target)
}
