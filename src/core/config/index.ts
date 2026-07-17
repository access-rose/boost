import { drive } from "./drive"
import { forms, type FormsConfig } from "./forms"

export const config: {
  drive: { enabled: boolean; progressBarDelay: number; unvisitableExtensions: Set<string> };
  forms: FormsConfig
} = {
  drive,
  forms
}
