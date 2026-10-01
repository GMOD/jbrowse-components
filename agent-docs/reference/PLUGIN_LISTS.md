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

## Desktop: global plugins

**Two read paths, on purpose.** `readGlobalPlugins()` returns every entry, disabled
included, and propagates a read failure; `getGlobalPlugins()` returns the enabled
entries and degrades a failure to empty.

- An editing surface must use `readGlobalPlugins`. A failed read that looks empty makes
  the dialog save "[] plus whatever you just clicked" over the user's list.
- A loading surface must use `getGlobalPlugins`. A corrupt file must not take the
  session down.

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

## The crash marker: one state machine, two markers

Four rules, each a Desktop bug first, holding in both products:

1. **Arm after the read.** Arming unconditionally told a user with no global plugins,
   after any unrelated crash, that global plugins had failed.
2. **Arm only when the enabled list is non-empty.**
3. **Do not clear during a safe-mode boot.** `markGlobalPluginLoadFinished()` is a no-op
   in safe mode; clearing re-armed the plugins and the app worked every other launch.
4. **Only the user clears it.** `reloadWithGlobalPlugins()` takes safe mode off.

## Installing a plugin restarts jbrowse-web

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

