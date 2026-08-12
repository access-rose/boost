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
* **Events after the `<body>` swap fire in a fixed order, and only once the new page's `<head>` scripts have loaded.** Boost awaits the incoming `<head>`'s external `<script src>` *during* the head merge — before the swap — which Turbo does not. So after the body is replaced the order is: a page script's `connect`/`render` callbacks → **`boost:render`** (the new body is in place; `{ renderMethod }`) → **`boost:load`** (the visit has completed; `{ url, timing }`) — and none of them can fire before that page's own initialization scripts have run. See [Navigation events](#navigation-events) for the full sequence and how `boost:render` differs from `boost:load`.
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

## Navigation events

Every Boost navigation fires **`boost:before-visit` first, then `boost:visit`** — before-visit is your chance to cancel, visit announces that the navigation is going ahead:

* **`boost:before-visit`** fires at *proposal time, before any request is made*. It is **cancelable** — call `event.preventDefault()` to stop the navigation and stay on the current page. Detail: `{ url }` (the destination).
* **`boost:visit`** fires *once the visit has started* (after `boost:before-visit` was allowed), as the request goes out. It is **not** cancelable — by this point the navigation is committed. Detail: `{ url, action }`, where `action` is `"advance"`, `"replace"`, or `"restore"`.

Within a single link-driven navigation the order is:

```
boost:click ──► boost:before-visit ──► boost:visit ──► boost:before-render ──► boost:render ──► boost:load
 (link only)     (cancelable)          (committed)
```

`boost:before-visit` fires for link clicks, `Boost.visit()`, and form submissions. **Back/Forward** (history restoration) skips it — restoration visits are not proposed and cannot be canceled — but still fires `boost:visit` (with `action: "restore"`). To guard against leaving on Back/Forward, use a native `window` `beforeunload` listener, not `boost:before-visit`.

### `boost:render` vs `boost:load`

These two look alike because they usually fire back-to-back at the end of a navigation, but they are subtly different:

* **`boost:render`** is a *rendering* signal — it fires **after Boost swaps the page `<body>`**. Detail: `{ renderMethod }` (`"replace"` for a normal navigation, `"morph"` for a refresh). It fires on ordinary visits, on morph/refresh re-renders, and on **in-place re-renders** such as a form coming back with validation errors (a `422`, or a `200` without a redirect) — anywhere the DOM is replaced. It does **not** fire on the first, server-rendered page load, because nothing was swapped.
* **`boost:load`** is a *navigation-complete* signal — it fires when **a page is fully loaded and settled**, the Boost equivalent of `DOMContentLoaded` that also fires across Drive navigations. Detail: `{ url, timing }` (the final URL and visit timing metrics). It fires once on the initial page load and once after each completed visit.

Rule of thumb: prefer registering scripts instead of events. Otherwise, **initialize your page in `boost:load`** — it fires once per page you land on, including the first server-rendered load. **Use `boost:render` only when you specifically need to react to a DOM swap** — e.g. to re-apply behavior after a validation-error re-render, or to branch on `renderMethod`. In a normal navigation `boost:render` fires first (the new body is in place) and `boost:load` follows once the visit completes; the initial page load is the one case that fires `boost:load` with no preceding `boost:render`.

## Expected permanent elements

A common complaint with Turbo has been that third-party integrations are difficult to preserve across page visits. Things like chat widgets, support frame, etc, are dynamically added to the page then lost on navigation.

Elements marked `data-boost-permanent` are preserved across navigations — but that only works when the element is in the server HTML of *both* the page you're leaving and the page you're entering, because Boost uses the incoming copy as the slot to teleport the live element into.

Boost adds **Expected permanent elements** for these integrations, specifically using new browser APIs to avoid cloning and reloading iframes.  Declare them per page with a `<meta>` in the head:

```html
<meta name="boost-expected-permanent-ids" content="intercom-container cookie-banner">
```

Or register ids from code. Programmatic ids persist until you remove them (independent of any page's meta), which suits a widget you load once and want on every page:

```js
Boost.addExpectedPermanentId("intercom-container")     // or an array of ids
Boost.removeExpectedPermanentId("intercom-container")
```

## Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md).

© 2026 37signals LLC (original Turbo). Fork modifications © 2026.
