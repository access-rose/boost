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
  #connected = new Map<PageScript, string>()
  #interactive = false

  register(name: string, script: PageScript) {
    this.#registry.set(name, script)
    // make sure connect and render are called once
    if (this.#interactive && this.#activeNames().has(name)) {
      this.#connect(script, name)
      this.#render(script)
    }
  }

  unregister(name: string) {
    const script = this.#registry.get(name)
    this.#registry.delete(name)
    // disconnect once the handler is no longer reachable via any other name.
    if (script && !this.#hasName(script)) this.#disconnect(script)
  }

  allowLeaving(to: URL) {
    for (const [script, name] of this.#connected) {
      if (script.beforeLeave?.({ name, to }) === false) {
        return false
      }
    }
    return true
  }

  disconnectDeparting() {
    const active = this.#activeScripts()
    for (const script of [...this.#connected.keys()]) {
      if (!active.has(script)) this.#disconnect(script)
    }
  }

  connectAndRender() {
    this.#interactive = true
    const active = this.#activeScripts()
    for (const [script, name] of active) this.#connect(script, name)
    for (const script of active.keys()) this.#render(script)
  }

  #connect(script: PageScript, name: string) {
    if (this.#connected.has(script)) return

    this.#connected.set(script, name)
    try {
      script.connect?.({ name })
    } catch (error) {
      console.error(error)
    }
  }

  #render(script: PageScript) {
    const name = this.#connected.get(script)
    if (name === undefined) return
    try {
      script.render?.({ name })
    } catch (error) {
      console.error(error)
    }
  }

  #disconnect(script: PageScript) {
    const name = this.#connected.get(script)
    if (name === undefined) return

    this.#connected.delete(script)
    try {
      script.disconnect?.({ name })
    } catch (error) {
      console.error(error)
    }
  }

  // De-duplicated set of active, registered scripts, mapped to the first active
  // name that resolves to each — so a handler under several active names appears once.
  #activeScripts() {
    const scripts = new Map<PageScript, string>()
    for (const name of this.#activeNames()) {
      const script = this.#registry.get(name)
      if (script && !scripts.has(script)) scripts.set(script, name)
    }
    return scripts
  }

  #hasName(script: PageScript) {
    for (const registered of this.#registry.values()) {
      if (registered === script) return true
    }
    return false
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
