---
name: plugin-lists
description: The four lists a plugin can be in, the two that survive a session (Desktop's global plugins, jbrowse-web's permanent plugins) and the one crash-marker state machine behind both safe modes, plus the app rebuild that any install triggers. Read before touching globalPlugins.ts, permanentPlugins.ts, the plugin store widget, or anything that compares two plugin definitions.
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

The last two are one design at two scopes — installed once, present on every
launch — and they answer the gap the first two leave: a config belongs to
whoever administers the deployment, and a session's list dies with the session
that carried it, so a new session or somebody's link starts without it. Desktop
has one user, one app and one list; a browser origin holds many JBrowses, which
is the whole reason the two implementations differ at all.

Each feature is small. What is not small is the state machine that keeps such a
plugin from bricking the app — the same four rules in both products — and the
fact that installing anything at all rebuilds the entire app. Those are the two
halves of this doc that keep being re-derived.

## Desktop: global plugins

Kept in `globalPlugins.json` under `userData` rather than in any one config.
Introduced in `c078e9f9c3`.

| Where | What it does |
| --- | --- |
| `electron/ipc/globalPluginHandlers.ts` | reads/writes the file; the read refuses anything that isn't a list |
| `src/components/StartScreen/globalPlugins.ts` | the renderer's whole contract: both read paths, safe mode, the crash marker |
| `.../useGlobalPluginsState.ts` | the dialog's edit state |
| `.../GlobalPluginsDialog.tsx` | the editing surface (start screen only) |
| `.../pluginManagers.tsx` | merges the list into every session, and builds the start screen's own manager |

### Two read paths, on purpose

`readGlobalPlugins()` returns **every** entry, including disabled ones, and
propagates a read failure. `getGlobalPlugins()` returns the **enabled** entries
and degrades a read failure to an empty list.

They are not interchangeable, and the split is load-bearing in both directions:

- An **editing** surface must use `readGlobalPlugins`. A read that failed must
  not look like an empty list to something about to write the list back — the
  dialog would save "[] plus whatever you just clicked" over everything the user
  had.
- A **loading** surface must use `getGlobalPlugins`. An unreadable or corrupt
  `globalPlugins.json` must not take the session down with it.

Web has one read path instead, and that is not an oversight: a browser that
refuses to read localStorage refuses to write it too, so there is no state where
the read returns empty and the write that follows lands.

### The disable flag

`disabled?: true` rides **on** the definition rather than wrapping it, so the
file stays the list of definitions it has always been and an entry from an older
build needs no migration — no flag means enabled. Enabling drops the key rather
than writing `false`, so a list toggled twice is the same file as one never
touched. Everything downstream (`samePlugin`, `dedupePlugins`, PluginLoader's
`structuredClone`) ignores fields it doesn't know.

### Merging into a session

`createPluginManager` merges `[...config.plugins, ...globalPlugins]` through
`dedupePlugins`, so **the config's entry wins a collision** — it is version-
pinned to what that session was built against.

`isGlobal` metadata is then set for the entries the global list, rather than the
config, is responsible for. The in-session plugin store reads it to *lock* the
plugin: a global plugin is in every session's plugin list but in no session's
config, so an uninstall there would filter a list it isn't in. A plugin the
config also declares is deliberately **not** marked global — dedupe kept the
config's copy, which the session can remove for itself.

Matching is by `samePlugin`, not identity, because PluginLoader deep-clones its
definitions.

### The dialog is start-screen only

Reaching it from a session means File → "Return to start screen", which the
plugin store's locked-plugin tooltip names. A Tools menu entry for it was tried
and rejected: it sits next to "Plugin store" and reads as a competing version of
the same thing.

## Web: permanent plugins

Kept in localStorage against the config being viewed rather than in that config
or in a session.

| Where | What it does |
| --- | --- |
| `products/jbrowse-web/src/permanentPlugins.ts` | the whole contract: the key, the list, safe mode, the crash marker |
| `.../SessionLoader.ts` `loadConfigAndPlugins` | merges the list in beside the config's own plugins |
| `.../createPluginManager.ts` | clears the marker, and says out loud when safe mode is on |
| `.../sessionModel/index.ts` | the session's mirror of the list, and the two actions the store widget calls |
| `.../components/PermanentPluginsDialog.tsx` | the list as a surface: switch one off, take one out |
| `plugins/data-management/.../InstalledPlugin.tsx` | the pin beside an installed plugin, which is how one gets in |

### The key is the resolved config url

`configKey()` is `configBaseUri(resolveConfigPath(?config))` — the same
resolution `SessionLoader` does to fetch the config, computed per call from the
url rather than taken from the loader, because the fatal error dialog reads the
list with no loader in existence.

**Not the origin**, which is what localStorage partitions by and what the trust
store (`trustedPlugins.ts`) is content to key on. jbrowse.org serves
`/code/jb2/main/`, `/code/jb2/latest/`, every pinned version and every `demos/*`
config from one origin. An origin-keyed list would load a plugin installed
against one build into all of them, including builds at a plugin ABI it was
never compiled for.

**Not the raw `?config=` either.** A page with no param has nothing to key on,
and a relative `test_data/volvox/config.json` names a different file under each
app path while spelling the same string. Resolving separates those, and joins
the other direction: a relative and an absolute spelling of one config find one
list.

**Nothing else from the query.** `session=`, `loc=` and `hubURL=` differ per
link, so folding the whole query in would mean a list that is never found twice,
and `adminKey`/`password` must not be written into a storage key at all.

The session database keys its rows on the **raw** `configPath` instead
(`rootModel/persistence.ts`, `sessionDbOps.ts`). Do not "fix" one to match the
other: a collision there groups two deployments' saved sessions together, which
is cosmetic, and a collision here loads code.

### What may write it

A click in the plugin store, and nothing else. No url param, no session
snapshot, no config field reaches it.

That is what lets the list skip the trust gate a config's plugins go through
(`checkPlugins`, `assertPluginsTrusted`): a config can arrive from another
origin by link, while this list can only have been written by the user, in this
app, on this config. If a way to write it from a url is ever added, the gate has
to come with it — the same plugin then runs on every future visit.

Desktop's list is not trust-gated either, for the same reason: installed by
explicit user action, not carried in by a page. Note the asymmetry anyway — a
custom global plugin is CJS-capable and loads into every session forever.

### A store ref is the entry that survives an upgrade

The list outlives the JBrowse it was written against, which is what makes a
pinned url a liability here: a build installed against one version keeps loading
after the deployment moves on. A definition carrying `storePlugin` — a store
ref, which names a plugin-store entry rather than a build — does not have that
problem. `loadPluginRecords` runs `resolveStorePluginRefs` over everything it is
given, so the entry resolves against the manifest for whatever version is
running, and falls back to its own pinned url when the store cannot be read.

An install from the plugin store mints a definition carrying both, so the list
gets that behaviour without asking for it. `readPermanentPlugins` therefore
keeps an entry that names a store ref and no url at all, where it drops one that
names neither.

### Recovery, and why web needs its own

Desktop has a start screen — a plugin-free surface with the editing dialog on
it. Web has none: the plugin store lives inside the session that fails to boot,
and `factoryReset` here only drops the url's params, so it cannot clear this
list. `crashedSession.ts` is a different marker for a different thing (one
session id, its remedy "don't restore that session"), and it does not help when
the plugin loads whatever session is open.

So the rungs are, in order: the fatal error dialog's **Reload without permanent
plugins** (`FatalErrorDialog`'s `extraActions`, which exists for exactly this),
the notification `createPluginManager` raises when a boot comes up in safe mode,
and the dialog under Tools, where an entry can be switched off without being
removed. A `disabled` entry is what makes the safe-mode banner actionable: a
user with three installed can find the culprit without reinstalling the innocent
two.

### The session's mirror

`session.permanentPlugins` is a **volatile**, seeded from storage at create and
refreshed through `onPermanentPluginsChanged`.

Volatile rather than a view, because a view is a MobX computed reading no
observable: it would compute once inside the plugin store's `observer` and cache
the list for the life of the tab. Volatile rather than a property, because the
list belongs to the browser — a shared or exported session must carry none of
it.

The change callback exists because the dialog writes the list without going
through the session at all. One subscriber, so it is a plain callback set: a
`storage` event is the general form and reports another tab's writes but never
this tab's, which is the half that matters.

### Where a plugin goes, and which list wins

`loadConfigAndPlugins` loads `[...config.plugins, ...pluginsNotIn(permanent,
config.plugins)]` — the config's entry wins a collision, matching the
session-plugin dedupe in `loadSession` and Desktop's merge order.

`pluginHome` (`PluginStoreWidget/components/util.ts`) asks the lists in that
same order, so it names the list the **loaded** copy came from: session, then
config, then permanent. A permanent entry the config shadows is deliberately not
offered for uninstall in the store — the click would visibly change nothing,
since the config still carries it — and the dialog is where that entry can be
taken out.

The pin moves a plugin between the session list and this one rather than copying
it. Two lists naming one plugin is a duplicate `PluginManager.addPlugin` refuses
by name, so the copy would be dead weight that has to be uninstalled twice.

## The crash marker: one state machine, two markers

A plugin that throws while its module is evaluated, hangs, or takes the renderer
down leaves no error anyone can act on. The marker is how the *next* launch
finds out. It holds the labels of the plugins that were about to load, and being
present at startup means `previousLaunchFailed` safe mode.

Desktop's is `LOADING_MARKER` in localStorage. Web's is
`jbrowse-plugin-load-marker:<config url>`, keyed the same way the list is, so
one deployment's crash is not another's.

**Four rules, each of which was a bug on Desktop before it was a rule.** They
hold in both products:

1. **Armed after the read, not before.** Arming it unconditionally meant a user
   with no global plugins at all was told, after any unrelated hard crash during
   session load, that global plugins had failed to load — and put into a safe
   mode that skips an empty list and changes nothing.
2. **Armed only when the enabled list is non-empty.** A list that is all
   switched off counts as empty: none of them ran, so a later crash is not
   theirs to answer for.
3. **Not cleared during a safe-mode boot.** `markGlobalPluginLoadSucceeded()` is
   a no-op in safe mode, because by construction nothing ran and nothing has
   been vouched for. Clearing it re-armed the plugins for the next launch, which
   reproduced the crash: the app worked every *other* time it was started.
4. **Cleared only by the user.** `reloadWithGlobalPlugins()` — the banner's
   "Re-enable", the menu item — is what takes safe mode off. That is why those
   affordances exist.

What differs, both on the web side:

- **Cleared at the END of `createPluginManager`**, not beside the
  `new PluginManager`, so the window it covers includes `configure()` — where a
  plugin registers its menu items and extension points, and where one that
  throws takes the app down just as thoroughly as one that throws while its
  module is evaluated.
- **`?safeMode` is read through app-core's query params**, not
  `window.location.search`: a jbrowse-web url whose params live in the hash
  keeps this one there too.

`loadPluginRecords` uses `loadSettled`, so a plugin that merely throws while
loading is already reported as a failure and never reaches the marker. What the
marker is for is the plugin that takes the tab with it.

Desktop's marker *value* is a JSON array of plugin labels so the banner can name
what was loading; a marker from a build that wrote `"1"` still reads as set,
which is all `readSafeModeReason` ever took from it.

`?safeMode` is the other trigger, checked with `.has()` — a bare `?safeMode`
reads back as the empty string. Nothing is accused under it: the user asked, and
no launch failed.

## Installing a plugin restarts jbrowse-web

A plugin cannot be added to a live `PluginManager` — pluggable elements are
registered once, at `createPluggableElements()`. So installing one in the plugin
store widget rebuilds the entire app: a new PluginManager, a new rootModel, and
the user's session re-applied from a snapshot.

The path is spread over six files and each hop carries a comment explaining only
its own half, which is why it is written down here once.

### The restart, end to end

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

### Which list a plugin is in

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

### A definition's identity is its url — never `pluginUrl`'s placeholder

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

### Two plugin sources meet in every product, and all three now dedupe

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

### What the store list hides, and why it is one function

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

## Things that look wrong and are not

Desktop:

- **The start screen builds its own plugin manager.** It has no session, so that
  is the only thing a plugin can extend before one is opened. It is memoized per
  write generation, not per mount: "Return to start screen" remounts, and
  rebuilding re-fetched and re-evaluated every plugin bundle to arrive at the
  same manager. Keyed on the generation so removing a plugin still takes effect
  on the way back.
- **`createStartScreenPluginManager` lives in `pluginManagers.tsx`** even though
  it needs none of the plugin graph. Splitting it out was tried and reverted —
  it broke the packaged app's RPC worker and saved no bytes. See the comment at
  the top of that file before retrying.
- **A global plugin's bundle is evaluated twice per launch** (start screen
  manager, then session manager). Sharing one manager would put the whole plugin
  graph in the start screen's eager path, which `pluginManagers.eager.test.ts`
  exists to prevent.

Web:

- **One read path, where Desktop has two.** Desktop splits `readGlobalPlugins`
  (propagates a failure) from `getGlobalPlugins` (degrades to empty) so an
  editing surface cannot save `[]` over a list it merely failed to fetch. The
  reason that does not carry over is under
  [Two read paths, on purpose](#two-read-paths-on-purpose).
- **An entry naming no loader is dropped on read.** It can never load, and
  `samePlugin` matches nothing against it, so it could only accumulate as a row
  nothing is able to remove.
- **The dialog's edits do not reload the app**, unlike the store's. They take
  effect on the next load, which is what the dialog says and what its Reload
  button is for; a full app rebuild per switch-toggle is not what a user hunting
  a culprit wants.
- **`markPermanentPluginLoadSucceeded` runs on the plugin-install rebuild too**,
  which re-arms and re-clears the marker. That is the same load, done twice, and
  the second pass is the one that counts.

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
