---
name: handoff-plugin-store-and-reload-review
description:
  Live state of the plugin-store / plugin-install-restart review — the
  end-to-end trace of the rebuild path, what landed, and the four findings
  deliberately left alone with the reason each is latent rather than live (the
  live store manifest was fetched to decide that).
---

# Plugin store + the SessionLoader restart — review, 2026-08-14

Read of the plugin store widget (`plugins/data-management/src/PluginStoreWidget`)
and the whole "install a plugin → rebuild the app" path
(`persistence.ts` → `useLoaderLifecycle` → `SessionLoader` →
`createPluginManager`). Branch `plugin-store-review`, one commit landed
(`9e62ee8a94`); the rest is written down here rather than changed.

## The restart, end to end

Worth having in one place, because it is spread over six files and each hop has
a comment explaining only its own half.

1. `PluginCard` / `InstalledPlugin` write the definition into **one of two
   lists** — `jbrowse.plugins[]` (config) or `session.sessionPlugins[]`.
2. Both writers call `root.setPluginsUpdated()`, which **latches** `true` and is
   never cleared (the replacement root starts fresh at `false`).
3. `setupSessionStorageAutosave`'s autorun (debounced 400ms) sees the flag and
   calls `reloadPluginManagerCallback(configSnapshotForReload(self),
   structuredClone(sessionSnap))`. A module-local `reloadRequested` makes it
   first-wins, since the flag latches and this root outlives the request.
4. `useLoaderLifecycle`'s callback builds a replacement `SessionLoader` from
   `getSnapshot(prev)` + the two snapshots, marks the old one `superseded`, and
   `setLoader`s it. A **second** call off the same rootModel (Apollo does this)
   is declined here — that is what `superseded` is for.
5. React swaps loaders; the old loader's effect cleanup runs
   `deactivate()` → `disposePluginManager()` → snapshot the session back into
   `sessionSource`, `rootModel.detach()`, `scheduleDetachedDestroy(rootModel)`.
6. The new loader `activate()`s: `loadConfig()` sees a preset `configSnapshot`
   so it only re-loads plugin records; `loadSessionByType()` sees a preset
   `sessionSource` of type `snapshot` and calls `loadSession(snap, true)` —
   `userAcceptedConfirmation: true`, so already-accepted session plugins skip
   the trust gate.
7. `ready` flips, the build autorun fires, `createPluginManager` builds a new
   PluginManager + rootModel and `initSession` applies the snapshot.

**The thing that keeps being mis-stated in comments**: the replacement app
restores from the snapshot *passed to the callback*, not from the sessionStorage
mirror. The mirror only matters for a subsequent hard browser refresh. That
misreading is what put the reload request inside the mirror's `try` (fixed).

## Landed

- **`pluginHome()`** (`PluginStoreWidget/components/util.ts`). `adminMode`
  answers where a *new* install goes; it does not answer where an existing one
  already is. An admin opening a shared/hub session that carries
  `sessionPlugins` got the config branch for those, and both outcomes were
  silent: uninstall filtered a list the plugin was never in (nothing removed, a
  whole-app reload anyway), and update `addPlugin`ed a second copy under the
  same UMD name, which `PluginManager.addPlugin` refuses by name on the next
  load — so the update did nothing while the admin's `config.json` kept the
  duplicate entry. Three call sites now go through `addPluginTo` /
  `removePluginFrom`.
- **The reload no longer rides inside the sessionStorage `try`**
  (`rootModel/persistence.ts`). Regression test:
  `rootModel/pluginReloadDespiteQuota.test.ts`.
- **Installed list**: filter before the empty check (a filter matching nothing
  rendered a blank region), and show the version off the pinned url — which the
  update tooltip already used — falling back to the plugin's self-declared
  version only for a custom/pre-versioning url.
- **One `PLUGIN_STORE_URL`**, exported from `core/checkPlugins.ts` and imported
  by `util/useFetchPlugins.ts`. The two copies were exactly the drift
  `useFetchPlugins`' own doc comment warns about, and they matter to each other:
  the gate rejecting a plugin the list just offered is what a v1/v2 split there
  looks like.

## Found, not changed

Ordered by how much I'd want them looked at.

### 1. `installableHere` reads only top-level urls (`PluginStoreWidget.tsx`)

```js
isElectron || Boolean(plugin.esmUrl || plugin.url || plugin.umdUrl)
```

`resolvePlugin` installs from `versions[]` and treats the top-level url as a
fallback; this filter never looks at `versions[]`. An entry published with
per-version urls only would vanish from web's list with no diagnostic —
`resolvePlugin`'s own comment says such entries are a shape it expects.

**Not live today.** I fetched
`https://jbrowse.org/plugin-store/v2/plugins.json` (14 entries, 2026-08-14):
every one mirrors its newest version's url at the top level, and none is
cjs-only. So this is latent. Fix would be
`[p, ...(p.versions ?? [])].some(s => s.esmUrl || s.url || s.umdUrl)`.

### 2. The vendored-plugin screen only covers the shared set, and only on web

`vendoredPluginNames` (`MafViewer`, `GWAS`) is filtered out of the store list by
`installableHere`, because installing one does nothing — `dropVendoredPlugins`
drops it at load. Two gaps:

- Desktop's `GlobalPluginsDialog` (`AvailablePlugins`) applies **no** vendored
  filter, so it will happily "install" one globally; it then shows as installed
  and does nothing.
- Neither surface consults `DESKTOP_VENDORED` (`['Blat']`), which is the
  product-specific half of the same list. Desktop's in-session store will offer
  Blat, which Desktop vendors.

Also latent: none of MafViewer/GWAS/Blat is in the live manifest, so the whole
screen currently filters nothing.

### 3. Trust and removal are keyed on `pluginUrl`, whose miss value is display text

`pluginUrl()` returns the literal `'unknown url'` for a definition naming no
loader. `maybePluginUrl` exists precisely so comparisons don't do that, and says
so — but three comparison sites still use `pluginUrl`:

- `trustedPlugins.ts` `rememberPlugins`/`arePluginsRemembered` — approving one
  unloadable definition marks every other unloadable one as trusted.
- `JBrowseModel.removePlugin` — removing one unloadable definition filters out
  every other unloadable one.
- `PluginStoreWidget/components/util.ts` `isSessionPlugin` (pre-existing).

All narrow, all silent. Worth a sweep to `maybePluginUrl` with an explicit
`undefined` guard; I left it because it touches trust-store semantics and
deserves its own change.

### 4. `createPluginManager` merges the two plugin sources without `dedupePlugins`

```js
...(model.runtimePlugins ?? []).map(asPluginRecord),
...(model.sessionPlugins ?? []).map(asPluginRecord),
```

react-app and desktop both `dedupePlugins` at the equivalent seam; web does not.
The consequence is bounded — `PluginManager.addPlugin` refuses the second copy
by name and warns — but web still *fetches and evaluates* the duplicate bundle
first, and `runtimePluginDefinitions` then holds only one of the two, which is
what the store's installed-check reads. A config and a session naming the same
plugin at different pinned versions is the case to think about.

### 5. Things I checked and found fine, so nobody re-derives them

- `doAnalytics` is already guarded by a module-level `analyticsSent`, so the
  rebuild does not double-count a pageview or report a ~0 load time.
- `disposePluginManager`'s `detach()`/`scheduleDetachedDestroy` sit **outside**
  the `if (session && isAlive(session))`, so a rootModel whose async
  `initSession` (hub/spec) had not produced a session yet is still torn down.
- `pluginsLoaded`'s `needSessionPlugins` and the `sessionPlugins ??= []` in
  `disposePluginManager` do line up across a dispose/re-activate cycle.
- The reload carries `sessionQuery`, `adminKey`, `password` etc. forward via
  `getSnapshot(prev)`; none of it re-fires because `sessionSource` is preset and
  short-circuits `loadSessionByType`.
- `installedVersionFromUrl` handles scoped package names
  (`@apollo-annotation/jbrowse-plugin-apollo`) correctly — the marker is
  `/<packageName>/`, and the live manifest mints exactly that path.

## Verification

`node node_modules/typescript7/bin/tsc --noEmit --checkers 1` clean;
`pnpm test plugins/data-management/src/PluginStoreWidget` (9 passed),
`pnpm test products/jbrowse-web/src/rootModel packages/core/src/checkPlugins`
(66 passed) plus the new suite. No browser-test run — the plugin-reload e2e
suite (`browser-tests/suites/plugin-reload.ts`) needs a build and was not
exercised.
