---
status: Accepted
summary: "A config node's props are a mapped type over the schema's own definition, replacing MST's `Record<string, any>` rather than intersecting with it, so an undeclared member is a compile error"
---

# ADR-145: A config node's props come off the schema definition

## Status

Accepted (2026-09).

## Context

`makeConfigurationSchemaModel` hands MST a `Record<string, any>` for its props,
because the slot table is data the factory walks at runtime rather than a type
it can name. So a config node admits every member name: `node.colorr` is `any`,
and so is `node.scales.y.domainMin`, which is how a sub-schema member is
reached.

[ADR-052](adr-052-slot-name-safety-is-a-write-guard.md) covers the other half
— the slot *name* a `getConf` or `setConf` call quotes, checked against the
schema when it is concrete and guarded at runtime on the write. Neither guard
reaches a direct member read. That is what made a mixin fabricate a holder type
to get its own member names checked (`ValueScaleHost`, since deleted), and what
let `HtsgetBamAdapter` read `htsgetBase` off a node typed as `BamAdapter`'s
config for as long as it did.

## Decision

**`ConfigurationSchemaType['Type']` names the props it derives, and nothing from
MST's own.**

```ts
readonly Type: ConfigNodeProps<DEFINITION> & ConfigNodeMembers & ConfigNodeBrand<this>
```

An intersection with MST's props was built first and measured: reads narrow, and
typos still compile, because the index signature on the other constituent
answers every name. Replacing is what makes an undeclared member an error, and
it costs nothing over narrowing alone — its error set was a strict subset of the
intersecting spike's, 60 against 67, with none the spike did not already have.

Four mechanisms hold it up, and each one fails quietly:

1. **The brand is a type alias.** TypeScript gives an intersection an implicit
   index signature only when every constituent is an alias or a mapped type, so
   an `interface` constituent blocks it — and MST's `IStateTreeNode` is an
   interface. `ConfigNodeBrand` restates it structurally, which is what keeps a
   concrete node assignable to `AnyConfigurationModel`. It carries `this`,
   because that brand is the only route from a node back to its schema:
   `ConfigurationSchemaForModel` walks it, and every slot-name constraint in the
   tree hangs off that walk. **Nothing but
   `scripts/audit-config-read-types.ts` reports losing it** — a spike that
   dropped the polymorphic `this` compiled clean while taking 137 unchecked
   reads to 333.
2. **`MergeConfigDef` is a flat mapped type** over `keyof BD | keyof D`.
   `Omit<BD, keyof D> & { … }` over a definition carrying an index signature
   collapses to the index signature alone — `Exclude<string | number, 'lodMode'>`
   is `string | number` — so every named base slot is dropped on every merge.
3. **`NormalizeSlotDef` keeps `type`, `model` and a widened `defaultValue`.**
   The description, `advanced`, `contextVariable` and the literal default are
   documentation and runtime; carrying them makes two schemas that differ only
   in a default mutually unassignable, and a subclass raising `fetchSizeLimit`
   stopped satisfying a parameter pinned to its base. This is also where the
   `.d.ts` shrinks.
4. **The identifier folds into the definition** as a synthetic
   `{ type: 'string'; defaultValue: '' }` entry. As a type parameter it lands in
   a `Record<K, …>` key position, reads as invariant, and stops a concrete
   schema widening to `AnyConfigurationSchemaType`; folded in, a subclass
   inherits it through the merge that already carries the base's slots.

Two smaller placements follow. `AnyConfigurationModel` carries the index
signature, since a schema widened to `AnyConfigurationSchemaType` has no slot
table to map — putting an `IsAny` branch inside the props instead leaves them a
deferred conditional, which makes `DEFINITION` unmeasurable, which makes it
invariant, which refuses the `out` annotation every display factory pinned to
its base schema needs. And `DEFINITION` is unconstrained on
`ConfigurationSchemaType`, with the authoring check re-applied where the literal
arrives, because satisfying the constraint means intersecting the index
signature back in.

## What it measured

Both columns from one clean build in one worktree.

| | main | this change |
| --- | ---: | ---: |
| `tsc --build tsconfig.build.json` errors | 0 | 0 |
| whole-project typecheck errors | 0 | 0 |
| unchecked config reads (source) | 131 | **121** |
| emitted `.d.ts` bytes, 3349 files | 16,762,491 | **16,455,474 (−1.8%)** |
| clean build | 25.7 s | 25.4 s |

Three `@ts-expect-error` probes in `configTypeNarrowing.test.ts` name an unknown
slot, an unknown sub-schema member and an unknown snapshot key. An unused
directive fails the typecheck, so a clean run says all three fire; removing two
of them produces exactly two `TS2551`s and nothing else.

## What the `any` was hiding

Five, of which the first two are the ones to recognise again:

- **`HtsgetBamAdapter` was registered with its own schema while its class
  inherited `BamAdapter`'s config type**, reading every slot through
  `this.config as unknown as HtsgetBamAdapterConfig`. `BamAdapterBase<CONF>` now
  holds everything past the open `BamFile` and each adapter supplies
  `configure()` against its own schema.
- **`ArcFetchModel` read and wrote `minScore` through a cast to the union of two
  display models**, neither of which carried the other's slots. The slot was
  declared twice verbatim; it is one `scoreFilterConfigSchemaFields` now, spread
  by both and named by the mixin.
- `GWASAdapter`'s config was not assignable to its base class's — an artefact of
  the broken base merge above, and a shape worth recognising: a `TS2416` on
  `config` between an adapter and its base is real when the merge is sound.
- The byte gate's `byteGateAdapterPath` was `string[]`, so its head was
  unchecked; it is `readonly ['adapter', ...string[]]`.
- `LinearReferenceSequenceDisplay` read `sequenceType` off a base track config.
  `createReferenceSeqTrackConfig` exports `ReferenceSeqTrackConfigModel` and the
  display narrows to it.

**The adapter registry paired a class with a schema by a shared `type` string
and nothing else**, which is what let the first of those stand. `AdapterType`
and `TextSearchAdapterType` are generic over their schema now and
`getAdapterClass` must return an `AdapterClassFor<SCHEMA>`, so registering an
adapter checks that the class reads the schema it was registered with.

## Rejected

- **Intersecting the derived props with MST's.** Narrows reads, detects no
  typos, and its `.d.ts` grows 2.7%.
- **Typing `create()` off the definition**, so it would refuse an unknown key.
  Measured twice. First at 115 test-tree errors, 101 of them an
  `explicitlyTyped` schema taking `type`; **re-measured once that became a type
  parameter, it is 1 build error and 47 in the test tree**, and the shape of the
  remainder is the answer rather than the count. Take `create`'s parameter off
  the definition and a `shorthand` schema stops accepting its bare string (12),
  and every `preProcessSnapshot` migration stops accepting the legacy keys it
  exists to rewrite — `uri`, `renderer`, `color1`, `_comment`, `drivers`,
  `fieldName`. **Refusing an unknown key means refusing keys that work.** None
  of the 47 was a real typo.

  The residual is not a type-system limit, though. `shorthand` threads exactly
  as `explicitlyTyped` did, and the shorthand vocabulary the rest of it needs is
  **already derived** — `generateConfigManifest` probes each `normalizeSnapshot`
  and records `shorthandKeys` for 59 schemas — just not anywhere a type
  parameter can reach. What it would take is in
  [ideas/typed-create-needs-the-shorthand-vocabulary.md](../ideas/typed-create-needs-the-shorthand-vocabulary.md).
  Until then `ConfigurationSnapshot<SCHEMA>` stays the opt-in check at the
  embedder boundary.
- **Walking the base chain for the identifier**, keyed on OPTIONS: 111 `TS2589`
  excessively-deep errors, one per consuming file. A one-level version keyed on
  the schema's own `EXPLICIT_IDENTIFIER` costs 56, because it puts
  `readonly trackId: string` on the base track schema's node and every widened
  node stops satisfying it.
- **Widening the adapter registry's construct parameter to `any`** to clear the
  43 contravariance errors it raises. One line against a generic, but it leaves
  the class/schema pairing unchecked, which is the defect above.
- **Narrowing `AbstractTrackModel.configuration` all the way**, which
  `LinearReferenceSequenceDisplay` refuses for the reason
  `packages/core/src/configuration/CLAUDE.md` gives. It is
  `BaseTrackConfig & { displays }`.

## Consequences

- **Run `scripts/audit-config-read-types.ts` after touching the node type.** It
  is the only thing that sees the brand degrading, and a degraded brand
  typechecks clean.
- **`type: string` on every node was a small lie, and is fixed.**
  `explicitlyTyped` is a type parameter now and the prop rides into the
  definition the way the identifier does, so only a schema that declares the
  option has it. `ConfigNodeMembers` was that lie plus `ConfigNodeActions`, and
  is gone.
- **`ConfigurationSnapshot` and `ConfigNodeProps` now overlap** — both read the
  definition, the first for keys going in and the second for values coming out.
  Worth a pass to see whether the first can be expressed over the second, now
  that the identifier and the base merge are already in the definition.
- `AbstractTrackModel.configuration` is optimistic for `ReferenceSequenceTrack`,
  whose schema is deliberately a subset of `createBaseTrackConfig`: a read of
  `assemblyNames` off a sequence track is typed and answers `undefined`.
  `WarningSource` already made the same call.
- Two surfaces widen on purpose with a comment saying why — `showCatalogTrack`,
  which takes whatever `session.getTrackById` answered, and the track selector's
  menu, where `session.tracks` is an MST union of every registered track schema.
  Typing `TrackCatalog.tracks` as `BaseTrackConfig[]` instead costs 62 errors
  across the embedded products.
