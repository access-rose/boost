(function () {
  const Boost = window.Boost
  window.lifecycleLog = window.lifecycleLog || []
  const log = (entry) => window.lifecycleLog.push(entry)

  const lifecycle = (name) => ({
    connect() {
      log(name + ":connect:dep=" + !!window.dep)
    },
    render() {
      log(name + ":render")
    },
    disconnect() {
      log(name + ":disconnect")
    }
  })

  Boost.registerScript(
    "app",
    Object.assign(lifecycle("app"), {
      beforeLeave({ to }) {
        log("app:beforeLeave:" + new URL(to).pathname)
        return window.appAllowLeave !== false
      }
    })
  )

  Boost.registerScript("a", lifecycle("a"))
  Boost.registerScript("b", lifecycle("b"))

  Boost.registerScript(["multi1", "multi2"], lifecycle("multi"))

  Boost.registerScript("boom", {
    connect() {
      log("boom:connect")
      throw new Error("boom")
    }
  })

  Boost.registerScript(
    "editor",
    Object.assign(lifecycle("editor"), {
      beforeLeave({ to }) {
        log("editor:beforeLeave:" + new URL(to).pathname)
        return !window.editorDirty
      }
    })
  )
})()
