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
every read for free. **Tightening those param annotations, one factory at a time,
is the remaining win** — it's mechanical and low-risk (see the blast-radius note
below). Most base factories (`linearCanvasBaseDisplayStateModelFactory`,
wiggle/alignments bases) still take `AnyConfigurationSchemaType`.

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

**D. Tighten factory `configSchema` params.** Mechanical rollout of the lever
above; unlocks narrowing at each converted factory's `getConf(self, …)` sites.

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
