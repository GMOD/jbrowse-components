---
name: global-plugins
description: Desktop's global plugin list — the two read paths and why they differ, the crash-marker state machine behind safe mode (when it is armed, what clears it, what deliberately does not), and the disable flag's storage contract. Read before touching globalPlugins.ts, the global plugins dialog, or anything that reads globalPlugins.json.
---

# Global plugins (Desktop)

Plugins the user installs once and gets in every session, kept in
`globalPlugins.json` under `userData` rather than in any one config. Introduced
in `c078e9f9c3`.

The feature is small. What is not small is the state machine that keeps a global
plugin from bricking the app, which spans five files and whose rules each look
arbitrary in isolation. This is that machine written down once.

## The pieces

| Where | What it does |
| --- | --- |
| `electron/ipc/globalPluginHandlers.ts` | reads/writes the file; the read refuses anything that isn't a list |
| `src/components/StartScreen/globalPlugins.ts` | the renderer's whole contract: both read paths, safe mode, the crash marker |
| `.../useGlobalPluginsState.ts` | the dialog's edit state |
| `.../GlobalPluginsDialog.tsx` | the editing surface (start screen only) |
| `.../pluginManagers.tsx` | merges the list into every session, and builds the start screen's own manager |

## Two read paths, on purpose

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

## The crash marker

A global plugin that throws while its module is evaluated, hangs, or takes the
renderer down leaves no error anyone can act on. The marker is how the *next*
launch finds out.

`LOADING_MARKER` in localStorage, holding the labels of the plugins that were
about to load. Present at startup ⇒ `previousLaunchFailed` safe mode.

Four rules, each of which was a bug before it was a rule:

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

Its *value* is a JSON array of plugin labels so the banner can name what was
loading; a marker from a build that wrote `"1"` still reads as set, which is all
`readSafeModeReason` ever took from it.

`?safeMode` is the other trigger, checked with `.has()` — a bare `?safeMode`
reads back as the empty string. Nothing is accused under it: the user asked, and
no launch failed.

## The disable flag

`disabled?: true` rides **on** the definition rather than wrapping it, so the
file stays the list of definitions it has always been and an entry from an older
build needs no migration — no flag means enabled. Enabling drops the key rather
than writing `false`, so a list toggled twice is the same file as one never
touched. Everything downstream (`samePlugin`, `dedupePlugins`, PluginLoader's
`structuredClone`) ignores fields it doesn't know.

## Merging into a session

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

## Things that look wrong and are not

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
- **Global plugins are not trust-gated** the way a `jbrowse://` link's are
  (`assertPluginsTrusted`). They were installed by explicit user action, not
  carried in by a page. Note the asymmetry anyway: a custom global plugin is
  CJS-capable and loads into every session forever.

## The dialog is start-screen only

Reaching it from a session means File → "Return to start screen", which the
plugin store's locked-plugin tooltip names. A Tools menu entry for it was tried
and rejected: it sits next to "Plugin store" and reads as a competing version of
the same thing.
