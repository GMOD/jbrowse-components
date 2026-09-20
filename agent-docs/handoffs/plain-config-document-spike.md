---
name: plain-config-document-spike
description: A spike on 2026-09-20 had every data adapter read its config as a plain document resolved against the schema's slot table rather than as an MST node, with no adapter and no test edited; the whole non-web suite passed but for one line in the MAF plugin, since fixed on main. The read half of the config system does not depend on MST. Unshown are honest types, validation, the web suites and the whole write half, and the open decision is whether to make adapter configs plain for real.
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
- **Validation.** `create` refuses a value outside an enum or of the wrong
  type, and the resolver checks nothing past `closed` and `preProcessSnapshot`.
  No suite depends on a worker refusing an adapter config, and a config that
  reached the worker through a hydrated track was validated on the main thread.
  The routes that hand a snapshot straight to a worker — `jb.getFeatures`,
  jbrowse-img, the CLI — were not checked.
- **The `jbrowse-web` jest project**, which only remote CI runs.
- **The adapter id.** `getAdapterId` hashes the stripDefault snapshot, and
  adapters prefix feature `uniqueId`s with it. The spike keeps that hash for a
  node it was handed and hashes the resolved document on the cache path, and no
  suite noticed the difference.
- **The write half.** An adapter config is never edited, observed or referenced
  by id. A display's and a track's are all three, so the next experiment is a
  display config as the table plus a document held in a `types.frozen` prop,
  with per-slot observability through computeds. Unread on that side: the config
  editor's internals, ADR-032's working copies, and the root, connection and
  internet-account configs.

## The decision this leaves

Whether to make adapter configs plain for real — an honest `config` type, a
validation pass off the slot table, the web suites on CI — as the first step of
taking the config system off MST nodes, or to stop at the spike.
