---
name: plain-config-document-spike
description: A spike on 2026-09-20 had every data adapter read its config as a plain document resolved against the schema's slot table rather than as an MST node, with no adapter and no test edited; the whole non-web suite passed but for one line in the MAF plugin, since fixed on main. The read half of the config system does not depend on MST. A Fable review the same day found the larger duplication on the write half — a track's config held as a plain document and as a throwaway MST node, reconciled by a debounced diff — and recommends one plain substrate reached through a write-half spike first. Nothing past the spike is agreed.
---

# A config as a plain document: the adapter spike

State on 2026-09-20. The spike is one commit on the branch
`worktree-plain-adapter-config-spike`, past main and not landed.

## The question

A review of the grammar-object write surface the same day found four defects,
and each one was two projections of the one slot table disagreeing: a type-level
base walk against the merged definition, a phantom `type` member against
`isSlotDefinitionEntry`, `setConf` classifying a member off the node against
`isConfigurationSubschema` classifying it off the definition, and `setSlot`'s
`null` against the snapshot merge's. The table is the source of truth, and the
MST model and the TypeScript types are both derived from it by hand.

So the question was whether a config can be the table plus a plain JSON
document, with no MST node. Adapters were the place to ask it: the worker builds
a node per adapter at one call in `dataAdapterCache.ts`, and an adapter only
ever reads.

## What the spike changed

- `plainConfig.ts`, new in core's configuration package on the branch:
  `resolvePlainConfig(schemaType, snapshot, jexl)` answers the document
  `schemaType.create(snapshot)` would hold — the schema's own `shorthand`,
  `closed` and `preProcessSnapshot`, every slot at its written value or its
  default, sub-schemas, arrays, maps and `type`-dispatched unions resolved the
  same way. `fileLocation` is the one builtin slot type whose MST model rewrites
  its input, so the resolver infers `locationType` as `FileLocation` does.
- `dataAdapterCache.ts` calls it in place of `configSchema.create`.
- `BaseAdapter`'s constructor converts a node it is handed, so every adapter
  unit test — which builds `new XAdapter(configSchema.create({…}))` and never
  reaches the cache — reads a plain document too.
- `readConfObject` evaluates a `jexl:` slot with the jexl instance the document
  carries under a symbol, where a node takes it from its env.

No adapter and no test was edited.

## What it measured

- **The whole non-web suite**: 1,987 of 1,990 suites and 22,346 of 22,360 run
  tests passed. All 14 failures were one line,
  `plugins/maf/src/util/loadSubAdapter.ts` spreading `getSnapshot(self.config)`
  into a sub-adapter config with the `type` swapped — the MAF adapter's whole
  config handed to BigBed or BedTabix, which worked because `create` drops the
  keys a schema does not declare. Each MAF adapter states the sub-adapter config
  it means on main now, from its own location slots, and with that the 97 MAF
  suites pass on the branch.
- **A sabotage**: dropping the default fill from the resolver fails 25 of 74
  tests across the BamAdapter, BigWigAdapter, VcfTabixAdapter and BedTabixAdapter
  suites, so the plain path is the one those adapters read.
- **A sweep** of 485 adapter-side source files for an MST node API applied to a
  config found no second site. `getAdapterId` already takes either form.
- **Timing**, indicative: `zzPlainBench.test.ts` on the branch, a
  BamAdapter-shaped schema, 5,000 iterations, three runs on AC power under
  jest. `create` costs 81-91 µs against 3.0-3.1 µs for the resolver, a slot read
  0.4 µs against under 0.05, a two-segment path read 1.2 µs against 0.2. An
  adapter builds one config, so none of this is a user-visible saving there.

## What it does not show

- **Honest types.** The spike leaves `BaseAdapter.config` typed as the MST
  instance while it holds a plain object, so `getSnapshot(this.config)`
  typechecks and throws — the MAF failure, on a path a test happened to run. The
  real version needs a schema brand of its own and `ConfigurationSchemaForModel`
  reading it. Of ADR-145's four mechanisms, the brand alias and the identifier
  fold exist because of MST's own types; `MergeConfigDef` staying a flat mapped
  type and `NormalizeSlotDef` are properties of a merged definition and survive
  any substrate.
- **Validation.** The resolver checks nothing past `closed` and
  `preProcessSnapshot`. An earlier draft of this file said `create` refuses a
  bad value where the resolver does not, and for most builds that is wrong: the
  MST fork type-checks only when `NODE_ENV` is not production or
  `setTypeChecking(true)` has run, and the one call in the tree is
  `products/jbrowse-web/src/components/Loader.tsx`, on jbrowse-web's main
  thread. So a production worker, jbrowse-desktop, the embedded components and
  jbrowse-img `create` a config unchecked today, which is why `setSlot` carries
  an `is()` guard of its own. Read off the code; no production bundle was run. A
  validator off the slot table would be a gain in every product rather than
  parity with one.
- **The `jbrowse-web` jest project**, which only remote CI runs.
- **The adapter id.** `getAdapterId` hashes the stripDefault snapshot, and
  adapters prefix feature `uniqueId`s with it. The spike keeps that hash for a
  node it was handed and hashes the resolved document on the cache path, and no
  suite noticed the difference.
- **The write half.** An adapter config is never edited, observed or referenced
  by id. A display's and a track's are all three.

## The second duplication, found by the review that followed

A Fable review the same day checked this file's claims and read the write half.
Its finding beyond the schema: **a track's config is held twice at runtime as
well.** `jbrowse.tracks` is `types.frozen`, a non-admin's edits are a frozen
`trackConfigDeltas` record, and every read or write of one goes through a
throwaway MST node hydrated from that document (ADR-031, ADR-032), which a
debounced whole-snapshot diff then writes back. Checked against the code:

- two savers, each on a 400 ms timer — the reaction in
  `packages/core/src/pluggableElementTypes/models/BaseTrackModel.ts` and the
  autorun in `plugins/config/src/ConfigurationEditorWidget/model.ts` — deduped
  in `updateTrackConfiguration`;
- `packages/product-core/src/Session/SessionTracks.ts` and
  `packages/core/src/util/trackConfigDelta.ts` hold the reconciliation;
- a delta records adds and changes and no deletion, so a non-admin's reset of a
  slot the admin config sets shows on screen and does not survive a reload.
  `trackConfigDelta.ts` records that as deliberate, to keep a deletion sentinel
  out of the shared JSON. ADR-146 has since made `null` that sentinel everywhere
  else.

The review's counts correct two above: the accessor calls are 583 in source by
the TypeScript audit, the 1,048 figure being source plus tests, and the external
checkouts hold 37 schemas in 19 plugins.

## The decision this leaves

The review recommends a plain document plus the slot table for every config,
with MST holding documents only, **on the condition that the end state is one
substrate** — assemblies, connections and internet accounts included — and
withdraws the recommendation if it is not. It calls the adapter-only hybrid the
worst place to stop, since two substrates is the defect this thread keeps
finding, and it puts the honest `BaseAdapter.config` type third rather than
first: that step measures the half already shown to work and retires none of
the risks that can end the direction.

Its first step is a throwaway spike of the write half, the mirror of this one:
`TrackConfigurationReference` and `DisplayConfigurationReference` answer a
handle over an observable resolved document, no display is edited, and the
non-web suite runs. It passes on a handful of distinct failures that are each an
MST node API applied to a config, and ends the direction on any semantic one —
an observer that did not fire, a refetch loop, identity churn between two views
of one track, a drag that wakes every reader.

None of that is agreed. Colin's to answer first: whether the non-admin reset is
a defect to fix, whether a prebuilt store bundle must load unmodified in v5,
whether the non-track configs become documents too, and whether production
builds should validate at all.
