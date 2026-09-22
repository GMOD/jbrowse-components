---
status: Accepted
summary: "A `transform` step is one of seven schemas, a `ConfigurationSchemaUnion` keyed by `type`: each step takes only its own slots with the defaults the worker reads, `type` is required, and a key of another step is refused at load. The helper dispatches on `type` in every build and refuses a member that is not explicitly typed, closed and named by its key. The display writes every step slot onto the wire, so a slot left at its default and one written at it are one fetch. The JSON schema dispatches on a strict `type` enum, and the config editor offers a type picker, add, remove and reorder on a union list only"
---

# ADR-150: A transform step is one schema per type

## Status

Accepted (2026-09-20).

## Context

The mark display's `transform` list held one flat schema, `MarkTransformStep`,
carrying every step's slots at once. A slot's empty default meant something
different per step: `field: ''` was `start` for a `bin` and `subfeatures` for a
`flatten`, and `as: []` stood for four things that `liftAs` and the worker's
fallbacks sorted out. `type` defaulted to `filter`, so `{ step: 1000 }` loaded as
a filter, and a key belonging to another step loaded and was never read.

The sentinels also split the fetch. The display sent the empty slots as
`undefined` and the worker filled in its own defaults, so a `bin` naming no
`field` and one naming `field: 'start'` drew the same picture from two cache
entries.

The config system could hold a list whose entries are one of several schemas —
`types.array(types.union(A, B))` already classifies as an array of sub-schemas —
but nothing dispatched it. A bare union loads a snapshot naming no member, or an
unknown one, as its first member and drops every key that member lacks, in the
production build too, where MST checks no types.

## Decision

**`ConfigurationSchemaUnion(name, { key: schema })` is the one way to build a
list entry that is one of several schemas.** The keys are the vocabulary, the
dispatcher picks the member off the snapshot's `type` and throws on a missing or
unknown one in every build, and each member node reads its `type` as its key at
the type level, so a `switch` over an entry narrows to that member's slots. The
helper throws at construction for a member that is not `explicitlyTyped`, not
`closed`, or named other than its key. A `closed` schema now admits the `type`
and identifier its own options install, which is what let the two options
combine at all. `getConfigurationSchemaUnion` is the handle the editor and the
JSON schema read; a pluggable element union is not one.

**`MarkTransform` is one, over `filter`, `formula`, `bin`, `aggregate`,
`coverage`, `flatten` and `pileup`**
(`plugins/marks/src/LinearMarkDisplay/markTransformConfigSchema.ts`). Each slot
carries its real default — `bin.field` `start`, `bin.as` `[start, end]`,
`formula.as` `value`, `coverage.as` `coverage`, `pileup.as` `row` — and
`flatten`'s index field is `index`, as the wire spells it. `liftAs` and
`DEFAULT_TRANSFORM_TYPE` are gone.

**The display writes every slot of every step onto the wire.** `stepsOf` is a
plain mapping with no default arm, so a step type it does not map is a compile
error, and each wire step carries all of its member's slots resolved.
`model.test.ts` pins both: the wire keys against the schema's, and one fetch key
for a slot left off and the same slot written at its default, for every slot of
every step type.

**The wire type stays hand-written in core**, optional fields and worker
defaults included, and the two sides are held together by tests rather than by
one file. The union's keys satisfy `StepSnapshot['type']`.
`markTransformConfigSchema.test.ts` asserts at the type level that the union,
the wire's `TransformStep` and the rule list's `StepSnapshot` name the same step
types, and that the union and `StepSnapshot` name the same slots for each; the
union-against-wire slot check is `model.test.ts`'s, at runtime. The same file
pins the vocabulary's defaults against the worker's constants and lists every
step slot's type, default and vocabulary.

**The config editor replaces an entry on a type change.** A type change is a
whole-list write putting a fresh entry of the new type at that place, which
loads by construction, rather than a slot write between two states — so
ADR-133's rule holds without a type slot to write. A union list also offers
move, remove and add; a list that is not a declared union offers none of it,
since a track's `displays` is added through the track. Entries key by place.

**The JSON schema dispatches the union on a strict `type` enum**, `$defs.Display`'s
shape with the member keys where Display has an any-string hint. A closed
object carries `x-closed`, so `jbrowse validate` says a load refuses an unknown
key there rather than that the key does nothing.

## Rejected

| Alternative | Why not |
| --- | --- |
| The step schemas beside `runTransforms` in `featureTransforms.ts` | The schema module reaches 40 runtime files, `featureTransforms.ts` 23, and the latter is in every encode worker. The type-level parity assertions buy the one-place guarantee without the bundle. |
| `modelName` as a `const NAME` type parameter on `ConfigurationSchema` | It retypes every explicitly typed schema in the repo and moves `configTypeNarrowing.test.ts`'s pins; the record key gives the literal where it is needed. A separate change with `audit-config-read-types.ts` as its oracle. |
| `oneOf` over the members in the JSON schema | ajv reports a failed `oneOf` as every member's own failure plus `must match exactly one schema in oneOf`, where the `if`/`then` arms report the one member the `type` names. |
| `$defs.Display`'s any-string `type` hint | A misspelt type then matches no arm and passes with its keys unchecked; driven by replacing the enum, which silenced the `fliter` case. |
| Required fields on the wire's step types | The core tests and benches write about 80 step literals, and a direct `CoreEncodeFeatures` caller would restate every default; writing every slot out in `stepsOf` gives the one fetch key without it. |
| Refusing a `bin.as` or `pileup.fields` of other than two names at load | The editor writes a `stringArray` one entry at a time and passes through the other lengths (ADR-133); the rule list says so (`step-pair`) and the step reads its default pair. |
| The colour objects as unions of scale kinds | ADR-135 made them one flat shape on purpose, the same channel read alike on four displays; a step is a verb with disjoint operands and no such reader. |
| A bare string step (`transform: ['pileup']`) | The dispatcher reads `type` off an object and refuses a string, and a step with no slots has nothing for a shorthand to lift into; it needs a lift in the helper. |

## Consequences

- A step names its `type`. `as: ['lineage']` on a formula is `as: 'lineage'`,
  and a flatten's `as` is `index`.
- A union entry's props read as the member its `type` names once that is
  read, and `readConfObject` checks the slot name from there; on an entry not
  yet narrowed it takes any name.
- An array of sub-schemas reads as its entries on a config node
  (`ConfigNodeValue`), so the `marks` callbacks lost their annotations.
- `jbrowse validate` reports a value a nested union refuses (`bin.step: 'wide'`),
  which two union errors at one path used to shadow into silence.
