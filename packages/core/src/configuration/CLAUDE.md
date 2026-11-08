# Configuration

`agent-docs/reference/CONFIG_PATTERN.md` covers reading a slot off the node
rather than a snapshot, forwarding a callback slot raw, and reference
resolution.

- **Read a setting with `getConf`/`readConfObject`**; a typed prop is the stored
  value, before `jexl:` evaluation and the default. Read a track's assemblies
  with `getTrackAssemblyNames`: `ReferenceSequenceTrack` has no `assemblyNames`
  slot.
- **A `null` write resets a slot to its default**, because JSON cannot spell
  `undefined`.
- **Send a worker `fullConfSnapshot`, not `getSnapshot`** — a worker has no
  schema to refill omitted defaults.
- **Write a settings bag (session spec, share link, agent call) through
  `applyConfSettings`**, which writes namespaces member by member and reports
  undeclared keys.
- **Lift both sides' shorthands and retired spellings before combining two raw
  bags** — `canonicalSpelling`, or member by member as `mergeConfSettings` does.
  Merged raw, a bare `mark: "line"` replaces the whole `mark` object instead of
  its `type`. Add a new merge path to
  `products/jbrowse-web/src/schemaTests/ShorthandMerges.test.ts`.
- **Wrap a new write path's `create` in `refusingUndeclaredKeys`**, or a typo
  becomes a console line.
- **Type a config snapshot as `ConfigurationSnapshot<SCHEMA>`**, which checks an
  object literal; `SnapshotIn` of a config schema checks nothing.
- An arg-less read of a `jexl:` slot still evaluates, against all-`undefined`
  names; a skip on empty `args` was measured and backed out.
