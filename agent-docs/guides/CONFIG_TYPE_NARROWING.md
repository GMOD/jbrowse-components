# Config type narrowing — status, traps, and leads

Handoff for an agent tightening config-read types (`getConf` / `readConfObject`
/ slot value types). Read this before touching
`packages/core/src/configuration/types.ts` or `configurationSchema.ts` — it
records what works, two traps that will mislead your experiments, and the
remaining opportunities.

## TL;DR: reads narrow off a concrete schema. Don't redo the value-type work.

Two layers are in place and **verified working**:

1. Precise slot value types (commit `484ea9ed69`): a `const DEFINITION` param on
   `ConfigurationSchema` preserves each slot's literal `type` through inference,
   and `SlotValueFromDef` (`types.ts`) keys on it.
2. Single-brand config-reference instance type (`IConfigurationReference`,
   `configurationSchema.ts`): `self.configuration` on a track/display model now
   carries the concrete schema, so **raw `getConf(self, 'x')` narrows** — the gap
   this doc used to call "the one real gap" is closed.

| Read site | Result |
| --- | --- |
| `adapter.getConf('x')` / `readConfObject(this.config, 'x')` (concrete `BaseFeatureDataAdapter<CONF>`) | ✅ precise |
| `readConfObject(self.conf, 'x')` where `get conf(): XConfig` | ✅ precise |
| `getConf(self, 'x')` — raw, **factory typed `configSchema: <ConcreteSchema>`** | ✅ precise |
| `getConf(self, 'x')` — raw, **factory typed `configSchema: AnyConfigurationSchemaType`** | `any` (by design; see below) |
| any read with a **typo'd** (nonexistent) slot name | silently `any`, **no error** (lead C) |

Proof (LSP hover): in `plugins/arc/src/LinearArcDisplay/model.ts`, whose factory
is typed `stateModelFactory(configSchema: LinearArcDisplayConfigModel)`,
`getConf(self, 'displayMode')` → `'arcs' | 'semicircles'` and
`getConf(self, 'thickness')` → `number`. Compile-time regression guards live in
`packages/core/src/configuration/configTypeNarrowing.test.ts` (checked by
`pnpm typecheck`, not jest — see "How to verify").

## The single actionable lever: type the factory's `configSchema` concretely

Narrowing flows through the schema's **definition brand**. A state-model factory
that annotates its param `configSchema: AnyConfigurationSchemaType` erases that
brand (its definition is `any`), so every `getConf(self, …)` inside stays `any`.
A factory that annotates the concrete schema type (e.g.
`configSchema: LinearArcDisplayConfigModel`, where
`LinearArcDisplayConfigModel = ReturnType<typeof configSchemaFactory>`) narrows
every read for free.

**Done (leaf factories):** arc, hic, maf, multirow, gwas-manhattan,
circular-chordvariant, LinearReferenceSequenceDisplay, MultiLinearWiggleDisplay.
Each was a one-line param retype (plus a named schema-type export where the
plugin only exported a factory/value). Pure type change, no runtime effect. The
sequence retype also let a `getConf(self,'height') as number | undefined` cast be
dropped (the `maybeNumber` slot narrows on its own).

**Only convert LEAVES, and let `pnpm typecheck` be the judge.** A factory that
is a **shared base** — instantiated by other displays with a *different,
extended* schema — must NOT be pinned to one concrete type: that erases the
subclass's extra slots and breaks the subclass's `getConf(self, 'extraSlot')`.
`LinearWiggleDisplay` is the trap: `LinearGCContentDisplay` builds on its factory
(imported via the `@jbrowse/plugin-wiggle` **package export**, so a file-path
grep for consumers misses it) and passes a wiggle-schema-plus-`windowSize`/…
schema. Pinning wiggle's param surfaced 3 `getConf` errors in gccontent — so it
was reverted. The reliable base detector is the **full typecheck after
converting**: a base used with an extended schema errors at the subclass; a true
leaf stays clean.

### Bases: pin to the concrete SHARED schema, NOT generic threading

An earlier version of this doc said the base factories
(`MultiSampleVariantBaseModel`, `LinearWiggleDisplay`,
`linearCanvasBaseDisplayStateModelFactory`, `LinearAlignmentsDisplay`) want
**generic threading** — `factory<S extends AnyConfigurationSchemaType>(configSchema: S)`.
That is the wrong tool, and the reason is mechanical: inside a generic body `S`
is known only by its constraint `AnyConfigurationSchemaType`, whose definition is
`any`, so `ConfigReferenceInstance<S>` hits the deliberate `IsAny<D> ? any`
special-case (`configurationSchema.ts`). **The base's own `getConf(self, …)`
reads stay `any` under generic threading.** Threading only narrows the
*consumers'* call sites — and the base subclasses (matrix, multisample,
LGVSynteny) have ~0 in-body reads, so it buys almost nothing. The bases hold the
reads (alignments 34, multisample 9, wiggle), and those live in the base body.

Tightening the **constraint** to a concrete schema — `factory<S extends
LinearWiggleDisplayConfigModel>(configSchema: S)` — does *not* rescue it, and is
worse: proved with a throwaway probe (a generic fn building
`ConfigurationReference(configSchema: S)` and reading `getConf(self,'color')`), TS
does not resolve `ConfigurationSlotName<ConfigurationSchemaForModel<ConfigReferenceInstance<S>>>`
through the constraint, so **every named `getConf(self, …)` in the body errors**
("`'color'` is not assignable to `ConfigurationSlotName<…<S>>`"), not just invalid
ones. So a generic base body can't read slots by name at all under a concrete
constraint. Don't retry generic threading in any form.

The lever that narrows a base's own body is pinning its param to the **concrete
schema it actually reads from** — its shared base schema, e.g.
`configSchema: SharedVariantConfigModel` (`= ReturnType<typeof sharedVariantConfigFactory>`).
This is the same single-brand mechanism as a leaf, just aimed at the shared
schema. Three preconditions:

- **(a)** every base read targets a slot on that shared schema (a subclass-only
  slot read would regress to `any`);
- **(b)** each subclass's *extended* schema stays assignable to the shared schema
  type, so the subclass can still pass it into the base param — held for variants,
  `ConfigurationSchema(name, {height}, {baseConfiguration: shared})` is assignable
  to the shared type (superset of props);
- **(c)** — the one that actually gates the remaining bases — **no consumer may
  read its *own* (non-shared) slots via `getConf(self, …)`.** The base owns the
  `configuration` prop, so every consumer inherits `IConfigurationReference<shared>`;
  pinning makes a consumer's own-slot read a hard **error** (not a silent `any`),
  because `getConf` is a single constrained signature — a slot name outside the
  pinned schema fails `SLOT extends ConfigurationSlotName<…>`. LGVSynteny and the
  multisample subclasses satisfy (c) with 0 own reads; gccontent violates it.

**The full typecheck settles (b)+(c); an LSP hover on a real base read settles that
narrowing actually happened (a green typecheck alone can't — `any` is assignable to
everything, Trap 1).**

**Done (shared-schema pin):**

- `MultiSampleVariantBaseModel` — param `SharedVariantConfigModel`, both subclass
  factories (`LinearMultiSampleVariant{Matrix,}Display`) retyped to the same so
  they pass an assignable schema in. Hover-verified:
  `getConf(self,'renderingMode')` → `'alleleCount' | 'phased'`, not `any`. The
  9th read is a dynamic `getConf(self, key)` — `any` regardless (dynamic key).
- `LinearAlignmentsDisplay` (34 base reads — the largest single win). The base is
  registered directly *and* composed by `LGVSyntenyDisplay` (0 own reads). Added
  a schema-type export `LinearAlignmentsDisplayConfigSchema = ReturnType<typeof
  configSchemaFactory>` (the plugin previously exported only the config
  *Instance*), pinned the base param to it, and retyped `LGVSyntenyDisplay`'s
  factory to its own `LGVSyntenyDisplayConfigModel` so its extended schema still
  passes in. Whole-repo typecheck clean — none of the 34 now-narrowed reads
  surfaced a mismatch. Hover-verified: `getConf(self,'coverageHeight')` →
  `number`.

**Remaining bases — both blocked (verified by investigation, not spiked because
payoff is low):**

- **`LinearWiggleDisplay` (3 base reads).** Blocked by **precondition (c)**:
  `LinearGCContentDisplay` reads its *own* slots — `getConf(self,'windowSize')`,
  `'gcMode'`, `'windowDelta'` in `shared.tsx` — off the wiggle base's inherited
  `configuration`. Pin the base and those three become hard errors ("`'windowSize'`
  not assignable to `ConfigurationSlotName<wiggle>`"). That is the exact "3 gccontent
  errors" a prior attempt hit and reverted. A **static** wiggle-schema base for
  gccontent (`import { linearWiggleDisplayConfigSchema }` instead of the runtime
  `pluginManager.getDisplayType('LinearWiggleDisplay').configSchema`) fixes only
  (b) — assignability — but (c) still breaks the reads, and generic threading can't
  rescue it (see the concrete-constraint probe above). The only clean fix is to
  give gccontent its own concrete display-schema type on `self.configuration`,
  which the shared wiggle base can't provide. Not worth it for 3 reads.
  (Contrast: `LGVSyntenyDisplay`/multisample subclasses have 0 own reads, so (c)
  holds and they converted.)
- **`linearCanvasBaseDisplayStateModelFactory` / `LinearBasicDisplay` base (8 reads,
  widest fan-in).** Doubly blocked. (c) fails — consumers read their own slots
  (`LinearMultiRowFeatureDisplay` has 3 own `getConf(self,…)`, etc.), which a pin
  would break. And its consumer `LinearVariantDisplay` is the exact display that
  can't be pinned at all without breaking the repo-wide `{ displayId: string }`
  structural check (`LinearVariantDisplayComponent` → `BaseLinearDisplay`; that's
  why the widened case is special-cased to `any`, and why variant stays widened).
  So even setting (c) aside, this base is **gated on Lead B** (surface `displayId`
  on the instance so variant can convert).

`DotplotDisplay`/`LinearSyntenyDisplay` have **empty** schemas
(`ConfigurationSchema('…', {}, …)`) — nothing to narrow, skip.

Net: every **cleanly-winnable** factory (6 leaves + sequence + multiwiggle leaves,
multisample + alignments bases) is converted. What's left is either empty (skip),
low-payoff-and-blocked (wiggle), or gated on Lead B (canvas + variant).

## How `IConfigurationReference` works (and why the earlier attempt failed)

`ConfigurationReference(schema)`'s return is annotated
`IConfigurationReference<SCHEMATYPE>`, a hand-written type whose **instance
(`Type`) is a single-branded `SCHEMA['Type']`** while its snapshot types stay
`ReferenceIdentifier | Snapshot{In,Out}<SCHEMA>` (so string-id and inline-snapshot
inputs still type-check — see the `SnapshotIn` warning in
`configuration/CLAUDE.md`). `ConfigurationSchemaForModel` then extracts the
schema from that single `IStateTreeNode<SCHEMA>` brand.

The earlier reverted attempt wrapped the instance in the runtime `ITypeUnion`.
`ITypeUnion<C,S,T>['Type']` is `STNValue<T, this>`, which re-brands `T` with
`IStateTreeNode<this>`; layered over an already-branded `SCHEMA['Type']` that
**double-brands** the node, and two competing `IStateTreeNode<…>` brands defeat
the single `infer SCHEMA` in `ConfigurationSchemaForModel` (→ `any`). The fix is
to `Omit` `Type` off `IType` and re-add a plain `Type: SCHEMA['Type']`, so no
second brand is introduced. (A raw `interface … extends IType<…> { Type: … }`
override trips TS's base-compatibility check against the deferred `STNValue`
conditional; the `Omit`+intersection type alias sidesteps that.)

**Widened schemas stay `any` on purpose.** `ConfigReferenceInstance` special-cases
`IsAny<D>` (definition = `any`, i.e. the schema is `AnyConfigurationSchemaType`)
back to `any`. Without this, the instance became `AnyConfigurationModel`, which
— unlike `any` — lacks a named `displayId`, breaking the one repo-wide site that
structurally checks a display model against `{ displayId: string }`
(`LinearVariantDisplayComponent` → `BaseLinearDisplay`'s model prop). Keeping the
widened case `any` preserves the exact prior behavior there while concrete
schemas narrow. This is why closing the gap did **not** require Lead B.

## `SlotValueFromDef` keys scalars on `type`, not `defaultValue`

A `type: 'number'` (or `'integer'`/`'boolean'`) slot can carry a **jexl-string**
`defaultValue` (arc `thickness` = `jexl:logThickness(...)`). Deriving the value
type from that default mistyped it as `string`; once `getConf(self, …)` narrowed,
that surfaced as real errors. `SlotValueFromDef` now keys the scalar types
directly on `type` (string/text/color → string; number/integer → number; boolean
→ boolean), falling back to the `defaultValue` widen only for unrecognized
custom `type`s. `readConfObject` evaluates jexl on read and returns the declared
value type, so the `type`-keyed result is what a read actually yields.

## Trap 1: the two-overload fallthrough (invalidates "typo" tests)

`readConfObject` / `getConf` each have a **typed overload** and a **loose
`(…): any` overload** (`util.ts`). A valid slot name binds the typed overload; an
**invalid** name fails its `SLOT` constraint and silently falls through to the
loose `any` — **no error**. So testing narrowing with a **bogus** slot name proves
nothing (it always "passes" via `any`). Always test a **real** slot name and
inspect the return type (LSP hover, or the `assertType<Equal<…>>` guards in
`configTypeNarrowing.test.ts`). An earlier pass concluded "types are all `any`"
purely from bogus-name tests; that was wrong. (This fallthrough is also why slot
typos are never caught — lead C.)

## Trap 2: opaque type variable → MST combinators collapse to `any`

Do **not** rebuild a config type by feeding a type variable into `types.union` /
`types.reference`. MST's combinators recover `IType<C,S,T>` only from a
**concrete** type; against an opaque `<SCHEMA extends IAnyType>` param they hit
the catch-all `union(...types: IAnyType[]): IAnyType` (fork
`index.d.ts`), compiling with **0 errors but an `any` instance**. Zero errors is
not proof — hover the result. (`extends IAnyType` as a generic **bound** is fine;
the damage is laundering a value *typed as* an opaque var through inference.)

## Leads worth chasing (ranked)

**A. (DONE) Single-brand reference type for `self.configuration`.** Implemented
as `IConfigurationReference`, above.

**B. Surface the identifier + named slots on the config instance.** The config
instance is `ModelInstanceTypeProps<Record<string, any>> & …` — slot names and
the identifier (`displayId`/`trackId`) survive only on the *schema* brand, not as
named instance props, so `Instance<schema>` doesn't structurally carry
`displayId: string` (that's why `DisplayModel` intersects `& { displayId: string }`
and why the widened case is special-cased to `any`). Fixing this is a **deeper
change** in how `makeConfigurationSchemaModel` derives its instance type
(`modelDefinition` is typed `Record<string, any>`, erasing the props) — plausibly
in the MST fork — with **wide blast radius**: every read across the app would
start type-checking for real. Do a throwaway spike and **count the errors** before
committing. Would let `DisplayModel` drop its `& { displayId: string }` patch.

**C. Catch slot-name typos.** Orthogonal and smaller. The loose `any` overload
(Trap 1) swallows invalid names. Tightening/removing it turns typos into errors —
but first measure how many existing loose reads (map-of-subschema, plain
snapshots, `session.tracks` entries) legitimately need it (the loose overload's
own comment in `util.ts` lists the intended cases).

**D. Tighten factory `configSchema` params.** Rollout of the lever above; unlocks
narrowing at each converted factory's `getConf(self, …)` sites. Two shapes: a
**leaf** takes a one-line param retype to its own schema type; a **base** (a
factory other displays compose with an extended schema) takes the concrete
**shared** schema it reads from, plus retyping its subclass factories — see "Bases:
pin to the concrete SHARED schema" above. Multisample + alignments bases done;
the canvas/wiggle bases remain.

## How to verify any change here

- Two TS versions on purpose (`agent-docs/guides/TOOLCHAIN.md`): lint runs 6.x,
  `pnpm typecheck` uses `typescript7`. Full check:
  `node node_modules/typescript7/bin/tsc --noEmit` from the repo root (~5 min).
- Prefer **LSP hover on a real read**, or the `assertType<Equal<…>>` compile-time
  guards in `configTypeNarrowing.test.ts`, over "0 errors" — both traps above make
  a clean typecheck a false positive. `Equal` distinguishes `any`, so the guards
  fail `pnpm typecheck` (not jest) when a read regresses.
- Reference/resolver unit tests: `configurationSchema.test.ts` (fast, ~2s).
  Integration: `products/jbrowse-web/src/tests/ConfigHydration.test.tsx`.
- Don't touch `TrackConfigurationReference`/`DisplayConfigurationReference`
  resolver bodies without reading `packages/core/src/configuration/CLAUDE.md`
  (frozen tracks + lazy hydration, ADR-031/032) and the `SnapshotIn` warning in
  `configurationSchema.ts` (keep it `string | SnapshotIn<schema>`).
