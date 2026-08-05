# Boost

Boost is a hard fork of [Hotwired Turbo](https://turbo.hotwired.dev). It uses complementary techniques to dramatically reduce the amount of custom JavaScript that most web applications need to write:

* **Boost Drive** accelerates links and form submissions by negating the need for full page reloads.
* **Boost Frames** decompose pages into independent contexts, which scope navigation and can be lazily loaded.
* **Boost Streams** deliver page changes over WebSocket or in response to form submissions using just HTML and a set of CRUD-like actions.

It's all done by sending HTML over the wire.

## How Boost differs from Turbo

Boost is **not** wire-compatible with Turbo. If you're coming from Turbo:

* The global is `Boost`, not `Turbo`. Events are `boost:load`, `boost:before-render`, … Elements are `<boost-frame>`, `<boost-stream>`, `<boost-stream-source>`. Attributes are `data-boost-*` and `<meta name="boost-*">`. The stream content type is `text/vnd.boost-stream.html`.
* **There is no snapshot cache and no preview.** Every navigation issues one request at click time and renders once. Back/Forward re-fetch from the network. `Boost.cache`, `boost:before-cache`, `data-boost-preload`, and `data-boost-prefetch` do not exist.
* **Form submissions that return `200` without a redirect render in place** (like a `422` does) instead of raising "Form responses must redirect to another location" — so a server can re-render a form with validation errors at a `200`.
* **New: a page-script lifecycle** (below) — the reason this fork exists.
* **Typescript Support** uses Typescript and exports types.

Streams are still available in this package, but we don't use Streams and it hasn't been validated with changes beyond the test framework. 

## Page-script lifecycle

A page declares the scripts it wants active with a `<meta>` tag, and registers their behavior by name:

```html
<!--
in the page's <head> (put shared ones in your layout)
"app" is just to demonstrate multiple names. You only need to add that if you want some scripts to run globally.
-->
<meta name="boost-script" content="app editor">
```

```js
Boost.registerScript("editor", {
  connect()           { this.form = watch(document.querySelector("#post-form")) },
  render()            { /* runs on every render while "editor" is active */ },
  beforeLeave({ to }) { return this.form.clean || confirm("Discard unsaved changes?") },
  disconnect()        { this.form.stop() }
})
```

`content` is a space-separated set of names. Boost tracks which names are active across renders and:

* runs **`connect`** once, when a name first appears (after the new `<body>` is in place **and** the page's own `<head>` scripts have executed — see below);
* runs **`render`** on every render while the name stays active (so a script shared across pages via your layout stays connected and just re-runs `render` — no teardown/rebuild churn);
* runs **`beforeLeave`** before every Boost navigation — returning `false` **cancels** it, which is how you prompt about unsaved changes.
* runs **`disconnect`** once, when a name is no longer present, just before the old `<body>` is swapped out;

`registerScript` also accepts an array — `Boost.registerScript(["app", "admin"], { … })` — to register one handler under several names. All four callbacks are optional and receive a `{ name }` context (`beforeLeave` also gets `{ to }`, the destination URL).

Because a script only runs on pages whose `<meta>` names it, page code never fires on pages it wasn't meant for — no `if (onThisPage)` guards.

### The lifecycle, per navigation

```
   Boost.registerScript(name, { connect, render, beforeLeave, disconnect })
                                    │  (behavior registered up front)
   ═════════════════════════════════╪══════════ a Boost navigation ══════════════
                                    ▼
        click / Boost.visit()
                │
                ▼
        ┌──────────────┐  any returns false
        │ beforeLeave()│ ───────────────────────►  CANCEL — stay on the page
        └──────┬───────┘  (each connected script)      (prompt for unsaved work)
               │ all allow
               ▼
        fetch the new page
               │
               ▼
        merge <head>  ──►  await new <script src>   (head scripts have now run)
               │
               ▼
        ┌──────────────┐  name absent from the new <meta name="boost-script">
        │ disconnect() │ ◄──── departing scripts   (old <body> still present)
        └──────┬───────┘
               ▼
        swap <body>
               │
               ▼
        ┌───────────┐   name newly present
        │ connect() │   (once)
        └─────┬─────┘
              ▼
        ┌──────────┐    every active script
        │ render() │    (every navigation)
        └─────┬────┘
              ▼
        boost:render ──► boost:load
   ══════════════════════════════════════════════════════════════════════════════
```

### One named script's states

```
                      meta lists it + registered
     ┌───────────┐  ────────────────────────────►   ┌───────────┐  ──┐
     │  inactive │                                  │ connected │    │ render()  (stays,
     │           │  ◄────────────────────────────   │           │  ◄─┘  re-runs each page)
     └───────────┘        disconnect()              └───────────┘
                     (meta no longer lists it)
```

### Timing and scope

* **`connect`/`render` run after the page's own `<head>` scripts have executed.** Boost awaits new external `<script src>` in the head (the way it already awaits stylesheets), so `boost:load` — and your `connect` — no longer fire *before* a page's initialization script has loaded.
* **`beforeLeave` only covers Boost navigations** (link clicks, `Boost.visit`, form submissions). It cannot cancel browser **Back/Forward** or **tab close / refresh** — for those, add a native `window` `beforeunload` listener in `connect` and remove it in `disconnect`.
* **`beforeLeave` also fires on the page's own form submission** (a redirecting POST is a navigation). Clear your "dirty" state on `boost:submit-start` so saving doesn't prompt.

## Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md).

© 2026 37signals LLC (original Turbo). Fork modifications © 2026.
