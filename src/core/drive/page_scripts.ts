export interface PageScriptContext {
  name: string
}

export interface LeaveContext extends PageScriptContext {
  to: URL
}

export interface PageScript {
  connect?(context: PageScriptContext): void
  render?(context: PageScriptContext): void
  beforeLeave?(context: LeaveContext): boolean | void
  disconnect?(context: PageScriptContext): void
}

export class PageScripts {
  #registry = new Map<string, PageScript>()
  #connected = new Set<string>()

  register(name: string, script: PageScript) {
    this.#registry.set(name, script)
    if (this.#activeNames().has(name)) {
      this.#connect(name)
      this.#render(name)
    }
  }

  unregister(name: string) {
    this.#disconnect(name)
    this.#registry.delete(name)
  }

  allowLeaving(to: URL) {
    for (const name of this.#connected) {
      if (this.#registry.get(name)?.beforeLeave?.({ name, to }) === false) {
        return false
      }
    }
    return true
  }

  disconnectDeparting() {
    const active = this.#activeNames()
    for (const name of [...this.#connected]) {
      if (!active.has(name)) this.#disconnect(name)
    }
  }

  connectAndRender() {
    const active = this.#activeNames()
    for (const name of active) this.#connect(name)
    for (const name of active) this.#render(name)
  }

  #connect(name: string) {
    if (this.#connected.has(name)) return
    const script = this.#registry.get(name)
    if (!script) return

    this.#connected.add(name)
    try {
      script.connect?.({ name })
    } catch (error) {
      console.error(error)
    }
  }

  #render(name: string) {
    if (!this.#connected.has(name)) return
    try {
      this.#registry.get(name)?.render?.({ name })
    } catch (error) {
      console.error(error)
    }
  }

  #disconnect(name: string) {
    if (!this.#connected.has(name)) return

    this.#connected.delete(name)
    try {
      this.#registry.get(name)?.disconnect?.({ name })
    } catch (error) {
      console.error(error)
    }
  }

  #activeNames() {
    const names = new Set<string>()
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="boost-script"]')) {
      for (const name of (meta.content || "").split(/\s+/)) {
        if (name) names.add(name)
      }
    }
    return names
  }
}
