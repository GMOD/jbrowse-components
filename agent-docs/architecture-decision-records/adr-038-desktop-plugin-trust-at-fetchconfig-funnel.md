# ADR-038: Desktop vets remote-config plugins at the `fetchConfig` funnel

## Status

Accepted (2026-07). Mitigation only — the underlying privilege is the subject of
`guides/DESKTOP_CONTEXT_ISOLATION.md`, which this ADR does not resolve.

## Context

`electron/window.ts` creates the main window with `nodeIntegration: true`,
`contextIsolation: false` and no preload. A plugin is therefore not sandboxed
code: `PluginLoader` hands its javascript to `fetchCJS`, which writes it to a
temp dir and `require()`s it, so a plugin runs with the user's full privileges.

A config declares its plugins. So "load this config" means "run this
javascript", and the only question that matters is whose config it is.

jbrowse-web already draws that line: `SessionLoader` triages plugins from a
cross-origin config or a session spec through `checkPlugins` and
`PluginWarningDialog` before loading them. Desktop had no equivalent, despite
strictly worse consequences — web's plugins run in a browser origin, desktop's
run in Node.

Two paths bring a config that the user did not write into Desktop:

- A `jbrowse://` link. Any web page can make the OS hand one to us
  (`electron/launchTarget.ts` → `?specLink=` → `openSpecLink`). One click, one
  browser confirm, arbitrary code execution — unprompted.
- The start screen's favorites/hubs (`leftSidePanel/LeftSidePanel.tsx`), whose
  entries are urls fetched with `fetchConfig` and merged.

## Decision

**Gate at `fetchConfig`, the single function through which a config the user did
not open from their own disk enters Desktop.** It calls `assertPluginsTrusted`
before returning, so an unvetted config is never written to disk nor handed to
`PluginLoader`. Trust is decided by `@jbrowse/core/checkPlugins` — moved out of
`products/jbrowse-web` so both products apply one rule. Unknown plugins raise a
native modal (`electron/ipc/pluginHandlers.ts`) listing each plugin and url,
defaulting to Cancel on both Enter and Esc.

`fetchConfig` moved to its own module so this gate does not sit in a file that
drags in the root model.

### Why the funnel and not the call sites

This was first implemented at `openSpecLink` only. That is the path the threat
model made obvious, and it was wrong: `LeftSidePanel`'s `launchSession` fetches
remote configs by a different route and loaded their plugins ungated. Gating one
caller left the other open and looked finished.

`fetchConfig` is the choke point — one door, so a new caller inherits the gate
instead of having to remember it. (Same lesson as `openLocation` being the
single `new LocalFile` site; see the guide.)

### Why a native modal and not `PluginWarningDialog`

The gate sits inside a promise chain (`launchFromLink`). A native dialog *is* a
promise, so it needed no plumbing through the async load path, and being OS-modal
it cannot be missed or styled away by whatever is on screen.

### Why locally-opened configs are not gated

Opening a `config.json`/`.jbrowse` from disk (`loadPluginManager`) prompts
nothing. This mirrors web treating a same-origin config as trusted: the user
chose the file.

The imperfection is deliberate and worth naming: a config **downloaded** and then
opened gets no prompt, though it is no more trustworthy than a linked one. The
line drawn is "did this arrive over the network on someone else's initiative",
not "did the user vouch for it". Tightening it would prompt on every local
session restore that uses a non-store plugin, which trains people to click
through — a worse outcome than the hole it closes. If desktop ever gains a
"remember this file" notion, revisit.

### What this does not decide

This is a mitigation, not the fix. It narrows *which configs* can reach
`require()`; it does not remove `require()` from the renderer. Any injected
content is still RCE, and a user who clicks "Load plugins" still gets a plugin
with full Node. The fix is `contextIsolation`, which
`guides/DESKTOP_CONTEXT_ISOLATION.md` plans and `electron/preload.ts` +
`electron/requireShim.ts` prepare for. Once that lands, this gate goes back to
being defense-in-depth rather than the thing standing between a link click and
code execution.

## Consequences

- A remote config naming a plugin that is not in the store, and not under
  `https://jbrowse.org/plugins/`, now prompts. Accepting loads it; declining
  aborts the load and returns to the start screen.
- The common cases stay silent and offline. `assertPluginsTrusted` returns early
  when there are no plugins, and `checkPlugins` short-circuits without touching
  the network when every plugin is already trusted — so a plugin-store outage
  never blocks a config that needed no verification. Vendored plugins
  (`MafViewer`, `GWAS`) are dropped first, matching web, so jbrowse.org demo
  configs that still list one do not prompt.
- `checkPlugins` now lives in `@jbrowse/core`; jbrowse-web re-exports it from its
  `util.ts`, so `SessionLoader` and its test mocks are unchanged.
- The prompt is the first thing a user sees when a colleague shares a
  `jbrowse://` link to a config with a custom plugin. Wording is a product
  decision, not a technical one.
- **Do not add a caller that fetches a remote config around `fetchConfig`.**
  That is how the favorites path was missed the first time. If a second fetch
  path ever becomes necessary, it gates itself or this ADR is void.
