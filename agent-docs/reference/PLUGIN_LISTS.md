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

The last two are one design at two scopes: installed once, present on every
launch. A config belongs to whoever administers the deployment and a session's
list dies with the session, so a new session or somebody's link starts without
them. Desktop has one user and one list; a browser origin holds many JBrowses,
which is why the two implementations differ.

The parts that keep being re-derived are the crash-marker state machine that
keeps such a plugin from bricking the app, and the fact that installing anything
rebuilds the entire app.

## Desktop: global plugins

| Where | What it does |
| --- | --- |
| `electron/ipc/globalPluginHandlers.ts` | reads/writes the file; the read refuses anything that isn't a list |
| `src/components/StartScreen/globalPlugins.ts` | the renderer's whole contract: both read paths, safe mode, the crash marker |
| `.../useGlobalPluginsState.ts`, `GlobalPluginsDialog.tsx` | the editing surface (start screen only) |
| `.../pluginManagers.tsx` | merges the list into every session, and builds the start screen's own manager |

### Two read paths, on purpose

`readGlobalPlugins()` returns every entry, disabled included, and propagates a
read failure. `getGlobalPlugins()` returns the enabled entries and degrades a
failure to an empty list.

- An editing surface must use `readGlobalPlugins`. A failed read that looks
  empty makes the dialog save "[] plus whatever you just clicked" over the
  user's list.
- A loading surface must use `getGlobalPlugins`. A corrupt `globalPlugins.json`
  must not take the session down.

Web has one read path: a browser that refuses to read localStorage refuses to
write it too, so no read-empty-then-write state exists.

### The disable flag

`disabled?: true` rides on the definition, so entries from older builds need no
migration. Enabling drops the key rather than writing `false`. `samePlugin`,
`dedupePlugins` and PluginLoader's `structuredClone` ignore fields they do not
know.

### Merging into a session

`createPluginManager` merges `[...config.plugins, ...globalPlugins]` through
`dedupePlugins`, so the config's entry wins a collision: it is version-pinned to
what that session was built against. `isGlobal` metadata marks entries only the
global list is responsible for, and the in-session plugin store locks those,
since uninstalling would filter a list the plugin is not in. A plugin the
config also declares is not marked global. Matching uses `samePlugin`, not
identity, because PluginLoader deep-clones definitions.

The dialog is start-screen only, reached from a session by File, "Return to
start screen". A Tools menu entry was rejected: beside "Plugin store" it reads
as a competing version of the same thing.

## Web: permanent plugins

| Where | What it does |
| --- | --- |
| `products/jbrowse-web/src/permanentPlugins.ts` | the whole contract: the key, the list, safe mode, the crash marker |
| `.../SessionLoader.ts` `loadConfigAndPlugins` | merges the list in beside the config's own plugins |
| `.../createPluginManager.ts` | clears the marker, and says out loud when safe mode is on |
| `.../sessionModel/index.ts` | the session's mirror of the list, and the actions the store widget calls |
| `plugins/data-management/.../InstalledPlugin.tsx` | the pin beside an installed plugin, which is how one gets in |
| `.../UnloadedPermanentPlugin.tsx` | a kept entry no loaded plugin came from: switch it off, take it out |
| `.../PermanentPluginSafeModeAlert.tsx` | the banner, and the way back out of safe mode |

### The key is the resolved config url

`configKey()` is `configBaseUri(resolveConfigPath(?config))`, computed per call
because the fatal error dialog reads the list with no `SessionLoader`.

- **Not the origin.** jbrowse.org serves `/code/jb2/main/`, every pinned version
  and every `demos/*` config from one origin, and an origin-keyed list would
  load a plugin into builds at a plugin ABI it was never compiled for.
  `trustedPlugins.ts` keys on origin; this list must not.
- **Not the raw `?config=`.** A page with no param has no key, and a relative
  `test_data/volvox/config.json` names a different file under each app path.
  Resolving separates those and joins a relative and an absolute spelling of one
  config.
- **Nothing else from the query.** `session=`, `loc=` and `hubURL=` differ per
  link, and `adminKey`/`password` must never reach a storage key.

The session database keys rows on the raw `configPath` (`rootModel/persistence.ts`,
`sessionDbOps.ts`). Do not make one match the other: a collision there groups
saved sessions, which is cosmetic, while a collision here loads code.

### What may write it

Only a click in the plugin store. No url param, session snapshot or config field
reaches the list, which is why it skips the trust gate a config's plugins pass
(`checkPlugins`, `assertPluginsTrusted`). Any new way to write it from a url must
bring the gate with it, since the plugin then runs on every future visit.
Desktop's list skips the gate for the same reason, and a custom global plugin is
CJS-capable and loads into every session.

### A store ref survives an upgrade

A definition carrying `storePlugin` names a plugin-store entry rather than a
build. `loadPluginRecords` runs `resolveStorePluginRefs`, so the entry resolves
against the running version's manifest and falls back to its pinned url when the
store is unreadable. A pinned url keeps loading a stale build after the
deployment moves on. A store install mints a definition carrying both, and
`readPermanentPlugins` keeps an entry with a store ref and no url while dropping
one with neither (it could never load, and `samePlugin` matches nothing against
it).

### Recovery

Web has no plugin-free start screen: the plugin store lives inside the session
that fails to boot, and `factoryReset` only drops the url's params.
`crashedSession.ts` is a different marker (one session id, remedy "don't restore
that session"). The rungs, in order:

1. The fatal error dialog's **Reload without permanent plugins**
   (`FatalErrorDialog`'s `extraActions`).
2. The notification `createPluginManager` raises when a boot comes up in safe
   mode.
3. The plugin store, where a `disabled` entry can be switched off without
   removal, so a user can find the culprit among several.

The plugin store is the whole surface. `unloadedPermanentPlugins` decides which
entries the Installed list would otherwise lack, and the banner sits above the
search field. Nothing in the UI revokes a remembered cross-origin trust
approval; `forgetTrustedPlugins` is the tests' reset.

### The session's mirror

`session.permanentPlugins` is a volatile, seeded from storage at create and
refreshed through `onPermanentPluginsChanged`. A view would be a MobX computed
reading no observable and would cache the list for the life of the tab. A
property would put browser state into shared and exported sessions. The change
callback is a plain callback set: a `storage` event reports other tabs' writes
but never this tab's, which is the half that matters.

### Which list wins

`loadConfigAndPlugins` loads `[...config.plugins, ...pluginsNotIn(permanent,
config.plugins)]`, the same order as `loadSession`'s session-plugin dedupe and
Desktop's merge. `pluginHome` asks session, then config, then permanent, so it
names the list the loaded copy came from. A permanent entry the config shadows
gets its own row from `unloadedPermanentPlugins`, because uninstalling from the
loaded row would visibly change nothing.

The pin moves a plugin between the session list and this one. Two lists naming
one plugin is a duplicate `PluginManager.addPlugin` refuses by name.

## The crash marker: one state machine, two markers

A plugin that throws during module evaluation, hangs, or takes the renderer down
leaves no actionable error. The marker tells the next launch: it holds the
labels of the plugins about to load, and being present at startup means
`previousLaunchFailed` safe mode. Desktop's is `LOADING_MARKER` in localStorage
(a JSON array of labels; a legacy `"1"` still reads as set). Web's is
`jbrowse-plugin-load-marker:<config url>`, keyed like the list.

Four rules, each of which was a Desktop bug first. They hold in both products:

1. **Arm after the read.** Arming unconditionally told a user with no global
   plugins, after any unrelated crash, that global plugins had failed.
2. **Arm only when the enabled list is non-empty.** An all-disabled list ran
   nothing, so a later crash is not its fault.
3. **Do not clear during a safe-mode boot.** `markGlobalPluginLoadFinished()` is
   a no-op in safe mode, since nothing ran and nothing is vouched for. Clearing
   it re-armed the plugins and the app worked every other launch.
4. **Only the user clears it.** `reloadWithGlobalPlugins()` (the banner's
   "Re-enable", the menu item) takes safe mode off.

Web differs in two ways. The marker clears at the end of `createPluginManager`,
so its window covers `configure()`, where a throwing plugin takes the app down
just as thoroughly. `?safeMode` is read through app-core's query params, not
`window.location.search`, so a hash-param url keeps it there. `?safeMode` is
checked with `.has()` (a bare one reads back as the empty string) and accuses
nothing.

`loadPluginRecords` uses `loadSettled`, so a plugin that merely throws is
reported as a failure and never reaches the marker.

## Installing a plugin restarts jbrowse-web

A live `PluginManager` cannot gain a plugin, since pluggable elements register
once in `createPluggableElements()`. Installing from the store rebuilds the app:
a new PluginManager, a new rootModel, and the session re-applied from a snapshot.

1. `PluginCard` / `InstalledPlugin` write the definition into
   `jbrowse.plugins[]` or `session.sessionPlugins[]`, chosen by
   [`pluginHome`](#which-list-a-plugin-is-in), not by `adminMode`.
2. Both call `root.setPluginsUpdated()`, which latches `true`; the replacement
   root starts at `false`.
3. `setupSessionStorageAutosave`'s autorun (debounced) calls
   `reloadPluginManagerCallback(configSnapshotForReload(self),
   structuredClone(sessionSnap))`. A module-local `reloadRequested` makes it
   first-wins.
4. `useLoaderLifecycle`'s callback builds a replacement `SessionLoader` from
   `getSnapshot(prev)` plus the two snapshots and marks the old one
   `superseded`, which declines a second call off the same rootModel (Apollo
   makes one).
5. The old loader's effect cleanup runs `deactivate()`, then
   `disposePluginManager()`: snapshot the session into `sessionSource`,
   `rootModel.detach()`, `scheduleDetachedDestroy(rootModel)`. The destroy half
   is required ([ADR-069](../architecture-decision-records/adr-069-detach-do-not-destroy-what-react-may-hold.md)).
6. The new loader's `loadConfig()` sees a preset `configSnapshot` and reloads
   only plugin records. `loadSessionByType()` sees a preset `snapshot`
   `sessionSource` and calls `loadSession(snap, true)`, so session plugins the
   user already accepted skip the trust gate.
7. `createPluginManager` builds the new manager and rootModel, and `initSession`
   applies the snapshot.

**The replacement app restores from the snapshot passed to the callback, not
from sessionStorage.** The sessionStorage mirror matters only for a later hard
refresh. Misreading this once put the reload request inside the mirror's `try`,
so an exceeded quota also ate the reload and the installed plugin never loaded.
`rootModel/pluginReloadDespiteQuota.test.ts` pins it.

### Which list a plugin is in

`adminMode` answers where a new install goes (`newPluginHome`), not where an
existing one is, and the two disagree when an admin opens a shared or hub session
carrying its own `sessionPlugins`. Editing the wrong list fails silently:
`removePlugin` filters a list the plugin was never in, so uninstall removes
nothing yet still asks for a reload; an update `addPlugin`s a second copy under
the same UMD name, which `PluginManager.addPlugin` refuses on the next load.
`pluginHome(plugin, session)` and the `addPluginTo`/`removePluginFrom` pair
(`PluginStoreWidget/components/util.ts`) are the route every call site takes.

### A definition's identity is its url, never `pluginUrl`'s placeholder

`pluginUrl()` returns the display text `'unknown url'` for a definition naming no
loader. Comparing on it made every unloadable definition the same plugin:
approving one trusted them all (`trustedPlugins.ts`), and removing one filtered
them all out of the config (`JBrowseModel.removePlugin`). `pluginDefinitions.ts`
has three primitives for three questions:

| Question | Use |
| --- | --- |
| what url does this load from, if any | `maybePluginUrl` |
| does this load from exactly this url | `isPluginUrl`, which guards both sides |
| is this the same plugin | `samePlugin` (name or url; a missing field never matches) |

### Config and session plugins dedupe in every product

A config's `plugins[]` and a session's `sessionPlugins[]` can name one plugin at
different pinned versions. `PluginManager.addPlugin` refuses the second by name,
but fetching and evaluating the duplicate bundle is waste and pushes a definition
through the trust gate the config path already vetted. react-app dedupes in
`createViewState`, desktop in `pluginManagers.tsx`, jbrowse-web in
`SessionLoader.loadSession` (`pluginsNotIn`, against the records `loadConfig`
already committed). The config's entry wins in all three.

### What the store list hides

`installablePlugins` (`util/pluginStore.ts`) is the single answer for the
in-session store widget and Desktop's global plugins dialog. An entry one
surface offers and the loader drops is a silent install: the button reads
"Installed" for a plugin that never ran. It hides an entry for two reasons:

- **No build this product can load.** Web runs ESM/UMD, so a CJS-only entry is
  Desktop-only. It asks every build the entry publishes, top-level and
  per-version, since `resolvePlugin` falls back to the top-level url for
  entries pinning urls per version.
- **Already vendored into the core bundle**, where `dropVendoredPlugins` drops
  the definition at load. Both `vendoredPluginNames` and
  `desktopVendoredPluginNames` count, and they live together because they are
  only read together.

An entry whose resolved build is CJS-only still shows: that is a fact about the
JBrowse version, and `PluginStoreCard` has a place to say so.

## Things that look wrong and are not

Desktop:

- **The start screen builds its own plugin manager.** It has no session. It is
  memoized per write generation, not per mount, since "Return to start screen"
  remounts and rebuilding re-fetched every bundle.
- **`createStartScreenPluginManager` lives in `pluginManagers.tsx`** though it
  needs none of the plugin graph. Splitting it out broke the packaged app's RPC
  worker and saved no bytes; read the comment atop that file before retrying.
- **A global plugin's bundle evaluates twice per launch** (start screen manager,
  then session manager). One shared manager would put the plugin graph in the
  start screen's eager path, which `pluginManagers.eager.test.ts` prevents.

Web:

- **A switch toggle does not reload the app**, unlike the pin. It takes effect on
  the next load, and under safe mode a rebuild would skip the list anyway.
- **`markPermanentPluginLoadFinished` runs on the install rebuild too**, re-arming
  and re-clearing the marker. The second pass counts.
- **`PLUGIN_STORE_URL` is one constant** in `core/checkPlugins.ts`, imported by
  `util/useFetchPlugins.ts`. The trust gate and the store list must read the
  same manifest, or the gate appears to reject a plugin the store just offered.
- **`disposePluginManager`'s `detach()`/`scheduleDetachedDestroy` sit outside**
  the `if (session && isAlive(session))`, so a rootModel whose async `initSession`
  had not produced a session is still torn down.

The only end-to-end exercise of the restart is
`products/jbrowse-web/browser-tests/suites/plugin-reload.ts`, which needs a
build. Jest covers everything but the React loader swap.
