---
name: permanent-plugins
description: jbrowse-web's permanent plugin list — why it is keyed on the resolved config url rather than the origin, what may write it and what may not, the per-config crash marker behind safe mode, and where the list is mirrored onto the session. Read before touching permanentPlugins.ts, the plugin store's keep toggle, or the merge in loadConfigAndPlugins.
---

# Permanent plugins (jbrowse-web)

Plugins the user installs once and gets on every visit, kept in localStorage
against the config being viewed rather than in that config or in a session.

Web already had two lists and neither answers "I want this plugin whenever I
open this JBrowse". `jbrowse.plugins[]` belongs to whoever administers the
deployment, and `session.sessionPlugins[]` dies with the session that carried
it — a new session, or somebody's link, starts without it. Desktop grew
[global plugins](GLOBAL_PLUGINS.md) for the same gap. What differs here is
scope: Desktop has one user, one app and one list, while a browser origin holds
many JBrowses.

## The pieces

| Where | What it does |
| --- | --- |
| `products/jbrowse-web/src/permanentPlugins.ts` | the whole contract: the key, the list, safe mode, the crash marker |
| `.../SessionLoader.ts` `loadConfigAndPlugins` | merges the list in beside the config's own plugins |
| `.../createPluginManager.ts` | clears the marker, and says out loud when safe mode is on |
| `.../sessionModel/index.ts` | the session's mirror of the list, and the two actions the store widget calls |
| `.../components/PermanentPluginsDialog.tsx` | the list as a surface: switch one off, take one out |
| `plugins/data-management/.../InstalledPlugin.tsx` | the pin beside an installed plugin, which is how one gets in |

## The key is the resolved config url

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

## What may write it

A click in the plugin store, and nothing else. No url param, no session
snapshot, no config field reaches it.

That is what lets the list skip the trust gate a config's plugins go through
(`checkPlugins`, `assertPluginsTrusted`): a config can arrive from another
origin by link, while this list can only have been written by the user, in this
app, on this config. If a way to write it from a url is ever added, the gate has
to come with it — the same plugin then runs on every future visit.

## A store ref is the entry that survives an upgrade

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

## The crash marker

`jbrowse-plugin-load-marker:<config url>`, holding the labels of the plugins
that were about to load. Present at startup ⇒ `previousLaunchFailed` safe mode.
Keyed the same way the list is, so one deployment's crash is not another's.

The four rules are [Desktop's](GLOBAL_PLUGINS.md#the-crash-marker), and each was
a bug there before it was a rule: armed after the read rather than before, armed
only when the enabled list is non-empty, never cleared during a safe-mode boot,
and cleared only by the user. What differs:

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

## Recovery, and why web needs its own

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

## The session's mirror

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

## Where a plugin goes, and which list wins

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

## Things that look wrong and are not

- **One read path, where Desktop has two.** Desktop splits `readGlobalPlugins`
  (propagates a failure) from `getGlobalPlugins` (degrades to empty) so an
  editing surface cannot save `[]` over a list it merely failed to fetch. That
  split does not carry over: a browser that refuses to read localStorage refuses
  to write it too, so there is no state where the read returns empty and the
  write that follows lands.
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
