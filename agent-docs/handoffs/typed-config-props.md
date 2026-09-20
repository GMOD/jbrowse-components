---
name: typed-config-props
description: Typed configuration props landed at zero errors — the error taxonomy, the latent bugs the `any` was hiding, and the two traps that make or break the approach
---

# Typed configuration props

Branch `worktree-agent-a9c5e4188f5908d2d`, tip `2bfaecf7ef`. The approach held.
`node node_modules/typescript7/bin/tsc --build tsconfig.build.json` and
`node --experimental-strip-types scripts/typecheck.ts` both report **0 errors**,
and `pnpm verify --full` is green.

A config node's props now come from a mapped type over the schema's own
definition: `node.color` is `string`, `node.scales.domainMin` is
`number | undefined`, and a slot inherited through `baseConfiguration` narrows
the same way. Sub-schema members read as that sub-config's node, and a bare
string/number entry reads as the volatile constant it becomes.

## The question that decides viability, answered

Under `variant-d.patch` as handed over, a whole-project typecheck reports 162
errors where `tsc --build` reports 67, `AnyConfigurationSnapshot` circularly
references itself, and — worst — `HostChecksSlotNames<ScoreScaleHost>` reads
`false`, i.e. `getConf`'s read-side slot-name check silently switches off for
every mixin host.

**Both are fixed, and they are two of the four root causes below.** The
regression is real and large: `node --experimental-strip-types
scripts/audit-config-read-types.ts` went from main's 137 unchecked source reads
to **333** under the patch, +196 call sites whose slot name stopped being
checked and whose value went back to `any`. It is now **131** — six better than
main, because `AbstractTrackModel.configuration` narrowed as a side effect.

The mechanism is worth stating plainly, because nothing about it is visible from
the patch. MST declares `readonly Type: STNValue<T, this>` on `IType`
(`node_modules/@jbrowse/mobx-state-tree/dist/index.d.ts:783`), so a config node
carries **its own schema** in the `IStateTreeNode` brand by polymorphic `this`.
`ConfigurationSchemaForModel` walks that brand back to the schema, and every
`getConf` / `readConfObject` / `setConf` slot-name constraint hangs off it.
Redeclaring `Type` on `ConfigurationSchemaType` drops the polymorphic `this`,
the brand degrades to `AnyConfigurationSchemaType`, and the whole read-side
guard goes with it — with no error anywhere, which is exactly the failure mode
ADR-052 describes. The override now restates it:

```ts
readonly Type: ConfigNodeType<DEFINITION> &
  ReturnType<typeof makeConfigurationSchemaModel<…>>['TypeWithoutSTN'] &
  IStateTreeNode<this>
```

## Error taxonomy

Four root causes covered all 67, plus two more the fixes exposed.

### 1. `& ConfigurationSchemaDefinition` on the merged definition — 48 of 67

`MergeConfigDef<DEFINITION, BASE> & ConfigurationSchemaDefinition` in the
patch's return type satisfies the constraint on `ConfigurationSchemaType`'s
first parameter by giving the definition an index signature. `Omit<BD, keyof D>`
over a type with an index signature collapses to the index signature alone:
`Exclude<string | number | 'lodMode', 'lodMode'>` is `string | number`. **Every
named base slot was dropped on every merge**, so base-merging only ever worked
for a schema whose own base had none.

Category: the mapped type is wrong. Fixed by leaving
`ConfigurationSchemaType`'s DEFINITION unconstrained — the authoring check
belongs on `ConfigurationSchema`'s own parameter, where the literal arrives —
and letting `MergeConfigDef` carry the merge unintersected.

That one change took the 44-error `AnyAdapter` cluster and the display-factory
`TS2345`s down to 8 apparent errors, and dropped `TS2456`
(`AnyConfigurationSnapshot` circular) and `TS2416` on `GWASAdapter`. **The 8 was
a false green**: `ConfigIdentifierProps` was mid-edit and erroring, which
silenced everything downstream of `Type`. The true count after this fix alone is
63.

### 2. The adapter registry erases the class/schema pairing — 44 of 67

`AdapterType` held `configSchema` and `getAdapterClass` as independent fields
tied only by a shared `type` string. With concrete node types, `AnyAdapter`'s
construct parameter (`AnyConfigurationModel`) is no longer assignable to a
subclass's own config, and construct-signature parameters are contravariant —
so every `new AdapterType({…})` in the tree failed.

Category: latent, and the honest fix makes it *checked* rather than widened.
`AdapterType<SCHEMA>` and `TextSearchAdapterType<SCHEMA>` are generic over the
schema they carry, defaulting to `any`, and `getAdapterClass` must hand back an
`AdapterClassFor<SCHEMA>`. Registering an adapter now checks that the class
reads the schema it was registered with. 44 → 1, and the 1 was a real bug (below).

### 3. Overriding `Type` drops MST's polymorphic `this` brand — 0 of 67, 196 silent regressions

See above. Invisible to `tsc --build`; found with
`scripts/audit-config-read-types.ts`. Category: the mapped type is wrong.

### 4. A conditional wrapping `ConfigNodeType` makes DEFINITION covariant — 7 of 67

`ConfigNodeType<D> = IsAny<D> extends true ? unknown : {[K in keyof D]: …}`
reads as the obvious way to answer early for a widened schema. It changes how
TypeScript measures DEFINITION's variance, from invariant to covariant, and
`relateVariances` **refuses a failed covariant type-argument check outright**
where a failed invariant one falls back to comparing the two types
structurally. Structural is the comparison that matters here: a subclass
schema's node has every slot the base's node does, while its *definition*
restates `defaultValue` and `description` and matches nothing —
`'jexl:lgvSyntenyTooltip(feature)'` is not assignable to
`"jexl:get(feature,'_mouseOver')||…"`.

Symptom: every display state-model factory handed a subclass schema
(`LGVSyntenyDisplay`, `LinearBasicDisplay`, `LinearGCContentDisplay`, the two
multi-sample variant displays) failed with an unreadable `Omit<Omit<…>>`
mismatch. Category: the mapped type is wrong. `ConfigNodeType` is now a plain
mapped type and the `IsAny` guard lives inside `ConfigNodeValue`, one level
down, where it does not affect the measurement. **Do not re-wrap it** — the
comment on it says why.

### 5. A track model's `configuration` was untyped — 2 of 67, plus 7 it exposed

`WarningSource.parentTrack.configuration` is pinned to `BaseTrackConfig` (it
reads `name`), but `AbstractTrackModel.configuration` was
`AnyConfigurationModel`, so no real display satisfied it. Category: latent.
`AbstractTrackModel.configuration` is now `BaseTrackConfig & { displays }`,
which is true of every track config, and the same follows through
`AbstractSessionModel`'s three track-menu members.

### 6. Test-only errors — 4, invisible to `tsc --build`

`tsc --build tsconfig.build.json` does not compile test files;
`scripts/typecheck.ts` does. Three fixture types and one inferred `Map`.

## Latent bugs the `any` was hiding

1. **`plugins/alignments/src/HtsgetBamAdapter/HtsgetBamAdapter.ts:11`** —
   registered with its own config schema (`htsgetBase`, `htsgetTrackId`) while
   its class inherited `BamAdapter`'s config type (`bamLocation`, `index`).
   Every read went through `this.config as unknown as HtsgetBamAdapterConfig`
   and nothing checked the slots it named. `BamAdapterBase<CONF>` now holds
   everything past the open `BamFile` and the two adapters each supply
   `configure()` against their own schema; the cast is gone and the reads are
   `this.getConf`.

2. **`plugins/arc/src/shared/ArcFetchModel.ts:102,132`** — `minScore` was read
   and written through `host(self)`, a cast to the **union** of the two arc
   display models. The two schemas declare different slots (only one has
   `lineWidth`), so neither side of the union carried the other's; it compiled
   only because a config node's props were `any`. `minScore` was also declared
   twice, verbatim, in `LinearArcDisplay/configSchema.ts:109` and
   `LinearPairedArcDisplay/configSchema.ts:63`. It is now one
   `scoreFilterConfigSchemaFields` in `shared/scoreFilter.ts`, spread by both,
   and the mixin names that field table with `ConfigModelForFields`, pinned by
   `HostChecksSlotNames` in `shared/scoreFilter.test.ts`.

3. **`plugins/gwas/src/GWASAdapter/GWASAdapter.ts:20`** — `GWASAdapter extends
   BedTabixAdapter` with a config declaring only `scoreColumn`,
   `scoreTransform`, `ldAdapter`, so its `config` was not assignable to the base
   class's. This was an artefact of root cause 1 (its schema *does* set
   `baseConfiguration`), and it resolved itself once the merge worked. Listed
   because the shape is worth recognising: a `TS2416` on `config` between an
   adapter and its base is a real class/schema mismatch when the merge is sound.

4. **`packages/display-kit/src/RegionTooLargeMixin.ts:133` and
   `packages/display-kit/src/CoarseTierMixin.ts:231`** — `byteGateAdapterPath`
   was `string[]`, so the gate's `getConf(track, path)` and
   `readConfObject(track.configuration, […path, 'fetchSizeLimit'])` were
   unchecked at the head. Now `ByteGateAdapterPath = readonly ['adapter',
   ...string[]]`: the head is the slot every track config has, and the tail
   names a sub-adapter slot no type reaches from there.

5. **`plugins/sequence/src/LinearReferenceSequenceDisplay/model.ts:155`** —
   `getConf(getContainingTrack(self), 'sequenceType')` reads a
   ReferenceSequenceTrack slot off a base track config. Real, and the honest fix
   is naming the schema: `createReferenceSeqTrackConfig` now exports
   `ReferenceSeqTrackConfigModel` and the display narrows to it.

## What was deleted, and what was kept

Deleted:

- **`ValueScaleHost` and `scaleNode`'s annotation**
  (`packages/wiggle-core/src/ScoreScaleMixin.ts`). Its doc comment said it was
  named "because a sub-schema member reads as `any` off the instance type" —
  which is the fact this change removes. `scaleNode` is now a plain helper whose
  type follows `ScoreScaleHost`, and `ScoreScaleMixin.test.ts`'s
  `@ts-expect-error` on `setConf(…, 'domainMinn', 0)` still fires through the
  derived sub-node type, so the check is unchanged.

Kept, each checked rather than assumed:

- **`ConfigurationSnapshot`** — still load-bearing. The MST props are still
  assembled as `Record<string, any>`, so only the *read* type changed;
  `SnapshotIn<typeof schema>` still accepts `{ preferance: 1 }` in silence
  (probed directly).
- **`ConfigModelForFields` and `HostChecksSlotNames`** — the mixin answer
  ADR-052's consequences section records, and this change used both rather than
  retiring them (arc, above). A mixin still cannot name its composing display's
  schema; typed props do not touch that.
- **`SubSchemaOf` and `ConfigurationSlotPathValue`** — the return types of
  path-form `getConf` / `readConfObject` / `BaseAdapter.getConf`. A typed node
  prop is not a substitute: `readConfObject` evaluates a `jexl:` slot and
  resolves defaults, which a raw prop read does not.
- **`scripts/audit-config-read-types.ts` and `scripts/configReadTypeGaps.txt`**
  — ADR-052 says they stay, and this change is the argument for it: they are the
  only thing that saw root cause 3 at all.

## Final numbers

| | before | after |
| --- | ---: | ---: |
| `tsc --build tsconfig.build.json` | 67 (variant-d) | **0** |
| `scripts/typecheck.ts` (whole project) | 162 (variant-d) | **0** |
| clean build wall time | 24.6 s (main, Colin) | **23.0 s** |
| emitted `.d.ts` bytes | +2.7% (variant-d, Colin) | **17,162,501** over 3367 files |
| unchecked config reads (source) | 137 main / 333 variant-d | **131** |
| `pnpm verify --full` | — | green |
| jest, the nine touched packages | — | 421 suites, 4873 tests, green |

Zero `TS2589`, zero `TS4058`.

## Left undone

- **The identifier prop still reads as `any`.** `trackId` / `displayId` /
  whatever `explicitIdentifier` names is not in `ConfigNodeType`, so it comes
  off the `ModelInstanceTypeProps<Record<string, any>>` index signature. Two
  shapes were built and measured, both worse than leaving it: walking the base
  chain (`GetInheritedIdentifier`-style, keyed on OPTIONS) costs **111 `TS2589`
  excessively-deep errors**, one per consuming file, the same wall the recursive
  base merge hit; a one-level version keyed on the schema's own
  `EXPLICIT_IDENTIFIER` costs **56 extra errors**, because it puts
  `readonly trackId: string` on the base track schema's node and every widened
  config node stops satisfying it. Closing it properly probably means folding
  the identifier into `MergeConfigDef` as a definition entry so it rides the
  existing merge instead of a second recursion.
- **Typo detection still does not work**, as expected and out of scope:
  `node.colorr` is `any`, because the intersection with
  `ModelInstanceTypeProps<Record<string, any>>` keeps an index signature alive.
- **`scripts/configReadTypeGaps.txt` is stale low**: the audit reports 131
  against a baseline of 137 and prints "Improved … re-run with `--write` to
  lower the baseline". Not re-baselined here, because `--write` also moves the
  generated measurement table in ADR-052 and that is a separate review. CI only
  fails when the count grows, so nothing is red.
- **`AbstractTrackModel.configuration: BaseTrackConfig` is optimistic for one
  track type.** `ReferenceSequenceTrack`'s schema is deliberately a *subset* of
  `createBaseTrackConfig` (no `assemblyNames`, `category`, `textSearching`,
  `formatDetails`), so a read of one of those off a sequence track is typed and
  answers `undefined` at runtime. `WarningSource` already made the same call and
  documents it; worth a checker or a narrower `TrackConfigCore` if it bites.
- **Two places widen on purpose, each with a comment saying why.**
  `packages/app-core/src/JbApi/jbApi.ts:1618` (`showCatalogTrack` takes what
  `session.getTrackById` answered, which may be a ReferenceSequenceTrack config)
  and
  `plugins/data-management/src/HierarchicalTrackSelectorWidget/components/tree/TrackSelectorTrackMenu.tsx`
  (`session.tracks` is an MST union of every registered track schema, which
  TypeScript can only read as a widened node). Typing `TrackCatalog.tracks` as
  `BaseTrackConfig[]` instead was tried and costs 62 errors across every
  embedded product — don't.
