import { cancelEvent } from "../../util"

export type SubmitterElement = HTMLElement & { disabled?: boolean; value?: string }

export type FormMode = "on" | "off" | "optin"

export type SubmitterConfig = {
  beforeSubmit: (submitter: SubmitterElement) => void
  afterSubmit: (submitter: SubmitterElement) => void
}

export type ConfirmMethod = (
  message: string,
  element: HTMLFormElement,
  submitter?: SubmitterElement
) => boolean | Promise<boolean>

export type SubmitterKey = "aria-disabled" | "disabled"

const submitter: Record<SubmitterKey, SubmitterConfig> = {
  "aria-disabled": {
    beforeSubmit: submitter => {
      submitter.setAttribute("aria-disabled", "true")
      submitter.addEventListener("click", cancelEvent)
    },

    afterSubmit: submitter => {
      submitter.removeAttribute("aria-disabled")
      submitter.removeEventListener("click", cancelEvent)
    }
  },

  "disabled": {
    beforeSubmit: submitter => submitter.disabled = true,
    afterSubmit: submitter => submitter.disabled = false
  }
}

class Config {
  #submitter: SubmitterConfig | null = null

  declare mode: FormMode
  declare confirm?: ConfirmMethod

  constructor(config: { mode: FormMode; submitter: SubmitterKey }) {
    Object.assign(this, config)
  }

  get submitter(): SubmitterConfig | null {
    return this.#submitter
  }

  set submitter(value: SubmitterKey | SubmitterConfig | null) {
    this.#submitter = typeof value === "string" ? submitter[value] : value
  }
}

export type FormsConfig = Config;

export const forms = new Config({
  mode: "on",
  submitter: "disabled"
})
