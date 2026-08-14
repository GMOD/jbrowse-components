---
name: plugin-install-restart
description: How installing a plugin in jbrowse-web rebuilds the whole app — the seven hops from the store widget's click to a new rootModel, which of the two plugin lists an edit goes into, and the two rules that keep being got wrong (the replacement app restores from the snapshot passed to the callback, not the sessionStorage mirror; and a definition's identity is its url, never pluginUrl's 'unknown url' placeholder). Read before touching the plugin store widget, SessionLoader's activate/deactivate cycle, or anything that compares two plugin definitions.
---

# Installing a plugin restarts jbrowse-web

A plugin cannot be added to a live `PluginManager` — pluggable elements are
registered once, at `createPluggableElements()`. So installing one in the plugin
store widget rebuilds the entire app: a new PluginManager, a new rootModel, and
the user's session re-applied from a snapshot.

The path is spread over six files and each hop carries a comment explaining only
its own half, which is why it is written down here once.

## The restart, end to end

1. `PluginCard` / `InstalledPlugin` write the definition into **one of two
   lists** — `jbrowse.plugins[]` (the config) or `session.sessionPlugins[]`.
   Which one is [`pluginHome`'s answer](#which-list-a-plugin-is-in), not
   `adminMode`'s.
2. Both writers call `root.setPluginsUpdated()`, which **latches** `true` and is
   never cleared. The replacement root starts fresh at `false`.
3. `setupSessionStorageAutosave`'s autorun (debounced 400ms) sees the flag and
   calls `reloadPluginManagerCallback(configSnapshotForReload(self),
   structuredClone(sessionSnap))`. A module-local `reloadRequested` makes it
   first-wins, since the flag latches and this root outlives the request.
4. `useLoaderLifecycle`'s callback builds a replacement `SessionLoader` from
   `getSnapshot(prev)` plus the two snapshots, marks the old one `superseded`,
   and `setLoader`s it. A **second** call off the same rootModel (Apollo does
   this) is declined — that is what `superseded` is for.
5. React swaps loaders; the old loader's effect cleanup runs `deactivate()` →
   `disposePluginManager()` → snapshot the session back into `sessionSource`,
   `rootModel.detach()`, `scheduleDetachedDestroy(rootModel)`. The detach-then-
   destroy split is ADR-069, and the destroy half is not optional.
6. The new loader `activate()`s. `loadConfig()` sees a preset `configSnapshot`,
   so it only re-loads plugin records; `loadSessionByType()` sees a preset
   `sessionSource` of type `snapshot` and calls `loadSession(snap, true)` —
   `userAcceptedConfirmation: true`, so session plugins the user already
   accepted in-session skip the trust gate.
7. `ready` flips, the build autorun fires, and `createPluginManager` builds the
   new PluginManager plus rootModel; `initSession` applies the snapshot.

### The replacement app does not boot from sessionStorage

**It restores from the snapshot passed to the callback.** The sessionStorage
mirror only matters for a subsequent hard browser refresh.

This keeps being mis-stated in comments, and the misreading has cost a bug: the
reload request sat inside the mirror's `try`, so an exceeded quota — the failure
the `catch` beside it exists to report — also ate the reload. The plugin the user
installed never loaded, and the only thing said out loud was an autosave error
that reads as unrelated. `rootModel/pluginReloadDespiteQuota.test.ts` pins it.

## Which list a plugin is in

`adminMode` answers where a **new** install goes (`newPluginHome`). It does not
answer where an **existing** one already is, and the two disagree whenever an
admin opens a shared or hub session that carries its own `sessionPlugins`.

Editing the wrong list is silent both ways: `removePlugin` filters a list the
plugin was never in, so uninstall removes nothing and still asks for a whole-app
reload; and an update `addPlugin`s a second copy under the same UMD name, which
`PluginManager.addPlugin` refuses by name on the next load — so the update does
nothing while the admin's `config.json` keeps the duplicate.

`pluginHome(plugin, session)` asks where the definition *is*, and
`addPluginTo`/`removePluginFrom` are the pair every call site goes through
(`PluginStoreWidget/components/util.ts`).

## A definition's identity is its url — never `pluginUrl`'s placeholder

`pluginUrl()` returns the literal `'unknown url'` for a definition naming no
loader. That is **display text**. Comparing on it makes every unloadable
definition the same plugin as every other, and the failure is always silent:

- approving one unloadable definition marked every other one trusted
  (`trustedPlugins.ts`);
- removing one filtered every other one out of the config
  (`JBrowseModel.removePlugin`).

The primitives are in `pluginDefinitions.ts` and there are three, for three
different questions:

| Question | Use |
| --- | --- |
| what url does this load from, if any | `maybePluginUrl` |
| does this load from exactly this url | `isPluginUrl` — guards **both** sides, since a core or global plugin recorded no install url either |
| is this the same plugin | `samePlugin` (name **or** url; a missing field never matches) |

`pluginUrl` is for showing a human, and nothing else.

## Two plugin sources meet in every product, and all three now dedupe

A config's `plugins[]` and a session's `sessionPlugins[]` can name the same
plugin, at different pinned versions. `PluginManager.addPlugin` refuses the
second copy by name, so the config's version runs — but arriving at that by
fetching and evaluating the duplicate bundle is waste, and it puts a definition
through the trust gate that the config path already vetted.

react-app dedupes in `createViewState`, desktop in `pluginManagers.tsx`, and
jbrowse-web in `SessionLoader.loadSession` (`pluginsNotIn`, against the records
`loadConfig` already committed — `initialize` awaits the config load before any
route reaches the session load, so `runtimePlugins` is settled). **The config's
entry wins in all three**, matching `createPluginManager`'s merge order.

## What the store list hides, and why it is one function

`installablePlugins` (`util/pluginStore.ts`) is the single answer, shared by the
in-session store widget and Desktop's global plugins dialog. An entry one surface
offers and the loader behind the other drops is a silent install — the button
reads "Installed" for a plugin that never ran, or stays live so every click
appends another dead entry.

Two independent reasons to hide an entry:

- **No build this product can load.** Web runs ESM/UMD, so a CJS-only entry is
  Desktop-only. Asked of every build the entry publishes, top-level *and*
  per-version: `resolvePlugin` treats the top-level url as the fallback for
  entries that pin urls per version, and reading only the top level dropped such
  an entry from Web's list with no diagnostic.
- **Already vendored into this product's core bundle**, where installing does
  nothing because `dropVendoredPlugins` drops the definition at load. Both halves
  of that list count — the shared `vendoredPluginNames` (MafViewer, GWAS) and
  `desktopVendoredPluginNames` (Blat, which Desktop bundles and Web does not).
  The desktop half is the one both surfaces were missing, and it lives next to
  the shared half because the two are only ever read together.

An entry whose *resolved* build is CJS-only is still shown: that is a fact about
this JBrowse version rather than about the product, and `PluginStoreCard` already
has a place to say so.

## Checked and found fine, so nobody re-derives them

- `doAnalytics` is guarded by a module-level `analyticsSent`, so the rebuild does
  not double-count a pageview or report a ~0 load time.
- `disposePluginManager`'s `detach()`/`scheduleDetachedDestroy` sit **outside**
  the `if (session && isAlive(session))`, so a rootModel whose async
  `initSession` (hub/spec) had not produced a session yet is still torn down.
- `pluginsLoaded`'s `needSessionPlugins` and the `sessionPlugins ??= []` in
  `disposePluginManager` do line up across a dispose/re-activate cycle.
- The reload carries `sessionQuery`, `adminKey`, `password` forward via
  `getSnapshot(prev)`; none of it re-fires, because `sessionSource` is preset and
  short-circuits `loadSessionByType`.
- `installedVersionFromUrl` handles scoped package names
  (`@apollo-annotation/jbrowse-plugin-apollo`) — the marker is `/<packageName>/`,
  and the store mints exactly that path.
- `PLUGIN_STORE_URL` is one constant in `core/checkPlugins.ts`, imported by
  `util/useFetchPlugins.ts`. Keep it that way: the gate and the list have to be
  reading the same manifest, and a v1/v2 split there looks like the gate
  rejecting a plugin the store just offered.

## Not covered by unit tests

`products/jbrowse-web/browser-tests/suites/plugin-reload.ts` is the only end-to-
end exercise of the restart, and it needs a build. Everything above is pinned by
`jest` suites except the actual React loader swap.
