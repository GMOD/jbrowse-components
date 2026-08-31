---
name: type-addview-against-the-launch-key-registration
description: the launch-key registration knows what each view accepts, but addView still takes Record<string, unknown> — a typo is caught at runtime and by the validator, never by the compiler
metadata:
  area: views, session, types
  category: ready
  order: 5
  first_move: "declaration-merge a `ViewSnapshotInputRegistry` the way `ExtensionPointRegistry` already works, and have each view's launchKeys module augment it"
---

# Type `addView` against the launch-key registration

[ADR-099](../architecture-decision-records/adr-099-a-view-takes-one-authored-object.md)
gave every view one authored object, and each view registers the keys it accepts
(`ViewType.launchKeys`, `ViewType.acceptedKeys`). Three consumers read that
registration already: the partition, the session-spec path and the validator's
`views` group. The compiler does not.

`session.addView(typeName: string, initialState = {})` takes
`Record<string, unknown>`, so nothing checks a key at the call site — 25
production call sites, none typed. The same hole is why `jbrowse-react-app`'s
`ManagedView` is open-shaped: with no per-type snapshot input to narrow against,
the `views` prop can only accept anything.

So a misspelled key is caught three ways — the view reports it on attach,
`jbrowse validate` errors, a session spec errors — and never by the editor the
author is typing into. That was the one argument for the shape v5 chose, and it
is the half still owed.

**The mechanism is already in the tree twice.** `ExtensionPointRegistry` and
`PluggableElementTypeRegistry` are declaration-merged interfaces a plugin
augments; a `ViewSnapshotInputRegistry` keyed by view type name, augmented from
each view's `launchKeys.ts`, gives `addView('LinearGenomeView', snap)` a checked
`snap` for a registered name while leaving an out-of-tree view's `addView` as
permissive as it is today. `LaunchSnapshotIn<M, Commands>` is the per-view type
to register; the `LaunchView-<type>` extension point is already fully typed this
way and is the worked example.

Watch two things the migration established. The widening cast is the **terminal**
link of a view factory — `CustomC` replaces the creation type, so a `.props()`
after it is invisible to `SnapshotIn`. And `types.snapshotProcessor` is not an
option: the wrapped model stops being a `ModelType`, and
`PluginManager.pluggableMstType` filters on `isModelType`, so the view leaves the
session union with nothing said.

Worth doing before v5 ships, because it is the compile-time half of the
type-safety case ADR-099 rests on, and because `ManagedView` widening for the
release is hard to narrow again afterwards.
