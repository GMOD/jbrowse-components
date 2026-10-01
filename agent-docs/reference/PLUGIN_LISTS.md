---
name: plugin-lists
description: The four lists a plugin can be in, the two that survive a session, the crash-marker state machine behind both safe modes, and the app rebuild any install triggers. Read before touching globalPlugins.ts, permanentPlugins.ts or the plugin store.
kind: spec
---

# Plugin lists

Four lists can name a plugin, and which one an edit lands in decides whether the
plugin survives the session, the visit, or the deployment:

| List | Product | Lives in | Gone when |
| --- | --- | --- | --- |
| `jbrowse.plugins[]` | both | the config | the administrator removes it |
| `session.sessionPlugins[]` | both | the session | that session ends |
| `globalPlugins.json` | Desktop | `userData` on disk | the user removes it |
| permanent plugins | jbrowse-web | localStorage, keyed per config | the user removes it, or the browser is cleared |

The last two are one design at two scopes: installed once, present on every launch.
Desktop has one user and one list; a browser origin holds many JBrowses, which is why
the implementations differ. Owners: `electron/ipc/globalPluginHandlers.ts` and
`src/components/StartScreen/globalPlugins.ts` (Desktop's whole renderer contract),
`products/jbrowse-web/src/permanentPlugins.ts` (web's).

## Desktop: global plugins

**Two read paths, on purpose.** `readGlobalPlugins()` returns every entry, disabled
included, and propagates a read failure; `getGlobalPlugins()` returns the enabled
entries and degrades a failure to empty.

- An editing surface must use `readGlobalPlugins`. A failed read that looks empty makes
  the dialog save "[] plus whatever you just clicked" over the user's list.
- A loading surface must use `getGlobalPlugins`. A corrupt file must not take the
  session down.

Web has one read path: a browser that refuses to read localStorage refuses to write it.

`disabled?: true` rides on the definition, so older entries need no migration.
Enabling drops the key rather than writing `false`.

`createPluginManager` merges `[...config.plugins, ...globalPlugins]` through
`dedupePlugins`, so the config's entry wins a collision (it is version-pinned to what
the session was built against). `isGlobal` metadata marks entries only the global list
owns, and the in-session plugin store locks those. Matching uses `samePlugin`, not
identity, because PluginLoader deep-clones definitions.

## Web: permanent plugins

**The key is the resolved config url**: `configKey()` is
`configBaseUri(resolveConfigPath(?config))`, computed per call because the fatal error
dialog reads the list with no `SessionLoader`.

- **Not the origin.** jbrowse.org serves every pinned version and `demos/*` config from
  one origin, and an origin-keyed list would load a plugin into builds at a plugin ABI
  it was never compiled for. `trustedPlugins.ts` keys on origin; this list must not.
- **Not the raw `?config=`.** A page with no param has no key, and a relative path
  names a different file under each app path.
- **Nothing else from the query.** `session=`, `loc=` and `hubURL=` differ per link, and
  `adminKey`/`password` must never reach a storage key.

The session database keys rows on the raw `configPath`. Don't make one match the other:
a collision there groups saved sessions, while a collision here loads code.

**Only a click in the plugin store writes the list.** No url param, session snapshot or
config field reaches it, which is why it skips the trust gate a config's plugins pass
(`checkPlugins`, `assertPluginsTrusted`). Any new way to write it from a url must bring
the gate with it, since the plugin then runs on every future visit. Desktop's list skips
the gate for the same reason.

**A store ref survives an upgrade.** A definition carrying `storePlugin` names a
plugin-store entry rather than a build; `resolveStorePluginRefs` resolves it against the
running version's manifest and falls back to its pinned url when the store is
unreadable. A pinned url keeps loading a stale build after the deployment moves on.
`readPermanentPlugins` keeps an entry with a store ref and no url, and drops one with
neither.

**Recovery.** Web has no plugin-free start screen: the plugin store lives inside the
session that fails to boot. The rungs: the fatal error dialog's **Reload without
permanent plugins**; the notification `createPluginManager` raises in safe mode; the
plugin store, where a `disabled` entry can be switched off without removal.
`crashedSession.ts` is a different marker (one session id). Nothing in the UI revokes a
remembered cross-origin trust approval; `forgetTrustedPlugins` is the tests' reset.

**`session.permanentPlugins` is a volatile**, seeded from storage at create and
refreshed through `onPermanentPluginsChanged`. A view would cache the list for the life
of the tab (a MobX computed reading no observable), and a property would put browser
state into shared and exported sessions. The change callback is a plain callback set,
since a `storage` event reports other tabs' writes but never this tab's.

**Which list wins.** `loadConfigAndPlugins` loads `[...config.plugins,
...pluginsNotIn(permanent, config.plugins)]`, the same order as `loadSession`'s dedupe
and Desktop's merge. `pluginHome` asks session, then config, then permanent. A permanent
entry the config shadows gets its own row from `unloadedPermanentPlugins`, because
uninstalling from the loaded row would visibly change nothing. Two lists naming one
plugin is a duplicate `PluginManager.addPlugin` refuses by name.

## The crash marker: one state machine, two markers

A plugin that throws during module evaluation, hangs, or takes the renderer down leaves
no actionable error. The marker holds the labels of the plugins about to load, and its
presence at startup means `previousLaunchFailed` safe mode. Desktop's is
`LOADING_MARKER` in localStorage; web's is `jbrowse-plugin-load-marker:<config url>`.

Four rules, each a Desktop bug first, holding in both products:

1. **Arm after the read.** Arming unconditionally told a user with no global plugins,
   after any unrelated crash, that global plugins had failed.
2. **Arm only when the enabled list is non-empty.**
3. **Do not clear during a safe-mode boot.** `markGlobalPluginLoadFinished()` is a no-op
   in safe mode; clearing re-armed the plugins and the app worked every other launch.
4. **Only the user clears it.** `reloadWithGlobalPlugins()` takes safe mode off.

Web differs: the marker clears at the end of `createPluginManager`, so its window covers
`configure()`. `?safeMode` is read through app-core's query params, not
`window.location.search`, and checked with `.has()` (a bare one reads back as the empty
string). `loadPluginRecords` uses `loadSettled`, so a plugin that merely throws is
reported as a failure and never reaches the marker.

## Installing a plugin restarts jbrowse-web

A live `PluginManager` cannot gain a plugin, since pluggable elements register once in
`createPluggableElements()`. Installing rebuilds the app: `root.setPluginsUpdated()`
latches; `setupSessionStorageAutosave`'s autorun calls
`reloadPluginManagerCallback(configSnapshotForReload(self), structuredClone(sessionSnap))`
(first-wins through a module-local `reloadRequested`); `useLoaderLifecycle` builds a
replacement `SessionLoader` and marks the old one `superseded`, which declines a second
call off the same rootModel (Apollo makes one). The old loader's cleanup runs
`disposePluginManager()`, whose `detach()`/`scheduleDetachedDestroy` sit outside the
`isAlive(session)` check so a rootModel with no session yet is still torn down. The
destroy half is required ([ADR-069](../architecture-decision-records/adr-069-detach-do-not-destroy-what-react-may-hold.md)).
The new loader sees preset snapshots and calls `loadSession(snap, true)`, so session
plugins the user already accepted skip the trust gate.

**The replacement app restores from the snapshot passed to the callback, not from
sessionStorage.** The mirror matters only for a later hard refresh. Misreading this put
the reload request inside the mirror's `try`, so an exceeded quota also ate the reload.
`rootModel/pluginReloadDespiteQuota.test.ts` pins it. A switch toggle does not reload;
under safe mode a rebuild would skip the list anyway.

**`adminMode` answers where a new install goes (`newPluginHome`), not where an existing
one is**, and the two disagree when an admin opens a shared or hub session carrying its
own `sessionPlugins`. Editing the wrong list fails silently: `removePlugin` filters a
list the plugin was never in, and an update `addPlugin`s a second copy under the same
UMD name. `pluginHome(plugin, session)` and `addPluginTo`/`removePluginFrom`
(`PluginStoreWidget/components/util.ts`) are the route every call site takes.

**A definition's identity is its url, never `pluginUrl`'s placeholder.** `pluginUrl()`
returns the display text `'unknown url'` for a definition naming no loader; comparing on
it made every unloadable definition the same plugin, so approving one trusted them all
and removing one filtered them all out. `pluginDefinitions.ts` has three primitives:
`maybePluginUrl` (what url, if any), `isPluginUrl` (exactly this url), `samePlugin`
(name or url; a missing field never matches).

**Config and session plugins dedupe in every product**, config winning: react-app in
`createViewState`, desktop in `pluginManagers.tsx`, jbrowse-web in
`SessionLoader.loadSession` (`pluginsNotIn`). `PluginManager.addPlugin` would refuse the
duplicate by name, but the bundle would be fetched and a definition pushed through the
trust gate first.

**`installablePlugins` (`util/pluginStore.ts`) is the single answer** for the in-session
store widget and Desktop's dialog. An entry one surface offers and the loader drops is a
silent install: the button reads "Installed" for a plugin that never ran. It hides an
entry with no build this product can load (web runs ESM/UMD; check every build the
entry publishes, since `resolvePlugin` falls back to the top-level url) and one already
vendored into the core bundle (`vendoredPluginNames`, `desktopVendoredPluginNames`,
which `dropVendoredPlugins` reads).

## Things that look wrong and are not

- **The Desktop start screen builds its own plugin manager**, memoized per write
  generation, not per mount: "Return to start screen" remounts, and rebuilding
  re-fetched every bundle.
- **`createStartScreenPluginManager` lives in `pluginManagers.tsx`** though it needs no
  plugin graph. Splitting it out broke the packaged app's RPC worker; read the comment
  atop that file before retrying.
- **A global plugin's bundle evaluates twice per launch.** One shared manager would put
  the plugin graph in the start screen's eager path, which
  `pluginManagers.eager.test.ts` prevents.
- **`markPermanentPluginLoadFinished` runs on the install rebuild too**; the second
  pass counts.
- **`PLUGIN_STORE_URL` is one constant** in `core/checkPlugins.ts`, so the trust gate
  and the store list read the same manifest.

The only end-to-end exercise of the restart is
`products/jbrowse-web/browser-tests/suites/plugin-reload.ts`.
