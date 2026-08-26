---
name: do-the-session-and-plugin-exports-surfaces-earn-a-baseline
description: recorded; build the plugin-`exports` baseline, and read the session one's blocker first
metadata:
  area: plugins, ABI
  category: ready
---

# Do the session and plugin `exports` surfaces earn a baseline

The recording half is done (`8e0893831f`): the six v5 removals are in
`SESSION_AND_PLUGIN_REMOVALS` in `knownRemovals.ts`, rendered into both
`PLUGIN_ABI_STABILITY.md` and the v5 upgrade guide by
`generate-abi-removals.ts`, and `knownRemovals.test.ts` guards the two-array
split. They could not go in `REMOVAL_GROUPS`: `abiPreviousRelease.test.ts`
requires every key there to be a `module#name` the previous release served, so a
session member filed there fails as stale.

What is left is whether either surface earns a baseline of its own, and the
answer differs by surface:

- **The plugin `exports` object is the cheap one and the one worth building.**
  It is shaped exactly like `abiBaseline.json`: from a product that loads every
  plugin, `pluginManager.plugins.map(p => [p.name, Object.keys(p.exports)])`
  against a committed JSON. Nothing observes that surface today —
  `check-published-plugins.ts:152` filters on `name.startsWith('@jbrowse/core/')`
  — and it is what would have caught `LinearGenomeViewPlugin.exports` dropping
  `BaseLinearDisplay`.
- **A session baseline has a concrete blocker, and one of its three answers got
  cheaper.** The record lives in `packages/core` and `./ReExports/knownRemovals`
  is still not in core's `exports` map (checked 2026-08-26);
  `packages/core/scripts/generateExports.mjs` derives that map FROM USAGE, so
  importing the record from `products/jbrowse-web` adds a permanent published
  subpath for a data module. The three answers were accept the subpath, move the
  record, or duplicate the list and let it drift. **What changed is that
  accepting it need no longer be silent**: `7dff0b3df2` added `preservedExports`
  to that script — a hand-listed set of subpaths kept in the map with a comment
  each saying why — plus `SUBPATH_REMOVALS` and an
  `abiPreviousRelease.test.ts` that fails a subpath the last release served and
  this map no longer does. A deliberate subpath is now a line someone wrote down
  rather than a side effect of an import. Note it still does not gate a NEW
  subpath, by design, so the decision remains a decision.
- **Neither baseline would have caught `getReferring`.** A name snapshot says
  nothing about a signature, and that removal is a signature change that answers
  `[]` in silence. Only `pluginFacingSessionApi.test.ts`'s shape — perform the
  call the way a published bundle spells it — catches that class, and it covers
  only bundles someone has read.
- **The type-export surface probably does not earn one.** `LayoutRecord` broke an
  out-of-tree *rebuild*, which is loud, and the in-tree compiler already covers
  it. It earned a changelog line, which it now has.
