# Plan: typed config reads for display state models

Follow-on to the internet-account proving ground (`CONFIG_TYPED_MODEL_READS_SCOPE.md`).
Goal: bring the cast-free typed-`conf`-getter pattern to display state models —
the high-value target (dense `getConf(self, 'slot')` reads, currently all `any`).

## The pattern (proven)

```ts
// 1. tighten the factory param to the concrete schema type
export function stateModelFactory(configSchema: ReturnType<typeof configSchemaFactory>) {
  return BaseDisplay
    .props({ configuration: ConfigurationReference(configSchema) })
    // 2. one typed accessor, cast-free
    .views(self => ({ get conf(): Instance<typeof configSchema> { return self.configuration } }))
    // 3. route reads through self.conf
    .views(self => ({
      get displayMode() { return readConfObject(self.conf, 'displayMode') as DisplayMode },
    }))
}
```

Why each step:
- **Step 1 is the precondition.** With `configSchema: AnyConfigurationSchemaType`,
  `Instance<typeof configSchema>` is `AnyConfigurationModel` → reads stay `any`.
  The schema comes from a no-arg `configSchemaFactory()`, so the concrete type is
  `ReturnType<typeof configSchemaFactory>` (type-only import from `configSchema.ts`
  — no runtime cycle). Callers in `index.ts` pass exactly that value, so tightening
  is source-compatible.
- **Step 2** is the cast-free recovery (the double-branded `self.configuration` is
  assignable to the single-branded concrete instance).
- **Step 3** types each read; drop redundant scalar annotations, keep `as Union`
  for stringEnum slots, keep `{ feature }` arg for jexl callback reads.

## Phasing

### Phase 1 — simplest display, end-to-end validation
Target: **`LinearReferenceSequenceDisplay`** or **`LinearBareDisplay`** (few slots,
no override mixin, no jexl). Establishes the factory-param tightening + `conf`
getter with minimal moving parts. Validate: tsgo clean, plugin tests pass, the
read returns the typed value (probe once with a `never`-assignment), an invalid
slot name is a compile error.

### Phase 2 — representative display with jexl + `??` reads
Target: **`LinearArcDisplay`** (6 reads: `displayMode` scalar + `color`/`thickness`/
`label`/`caption`/`arcHeight` as `{ feature }` jexl callbacks, some with `?? N`).
Confirms the pattern under feature-callback reads and that `readConfObject(self.conf,
'color', { feature })` keeps the args overload. Watch: jexl slots whose value is a
callback return the slot's declared type; `?? 2` fallbacks stay (slot may be
undefined). Sibling `LinearPairedArcDisplay` is a quick second.

### Phase 3 — high-value, override-mixin displays
Targets: **canvas `LinearBasicDisplay`**, **wiggle `LinearWiggleDisplay`**. These
already pass a concrete CONF to `ConfigOverrideMixin` (see
`key_pattern_getconfwithoverride_typing`), so the override path is typed; the
`conf` getter complements it for the **direct** `getConf` reads. Higher read
density = most annotations removed. Watch: shared mixins
(`WiggleScoreConfigMixin`, `BaseLinearDisplay`) are non-generic by design — don't
make them generic; the `conf` getter lives in the concrete leaf factory only.

### Phase 4 — sweep the rest opportunistically
Remaining `LinearDisplay` factories (variants, synteny, maf, hic, …), one per PR,
ordered by read density. No big-bang.

## Per-display checklist
- `configSchema.ts` exports a concrete model alias (add `export type XDisplayConfigModel = ReturnType<typeof configSchemaFactory>` if missing; mirror the adapter `XConfig`/`XConfigModel` convention).
- factory param: `AnyConfigurationSchemaType` → the concrete model type.
- add `get conf(): Instance<typeof configSchema>` in a views block before the readers.
- `getConf(self, 'x')` → `readConfObject(self.conf, 'x')`; `getConf(self, 'x', {feature})` → `readConfObject(self.conf, 'x', {feature})`.
- drop redundant `: string`/`: number`/`: boolean` getter annotations; keep `as Union` for stringEnum; keep `?? fallback`.
- `npx tsgo --noEmit` + `pnpm test <plugin>`; a read whose old `any` was used at the wrong type becomes a compile error — that's a real bug find, fix it.

## Findings from execution

### Phase 1 — validated on `LinearArcDisplay` (not the originally-named targets)
The two displays named for Phase 1 are duds: `LinearReferenceSequenceDisplay`
has **zero** config slots (its only `getConf` reads `sequenceType` off the
containing *track*), and `LinearBareDisplay`'s only slot is a pluggable
`renderer` subschema read via array-path with a `pluginManager`-arg factory —
neither exercises the scalar `readConfObject(self.conf, 'slot')` pattern. Promoted
**`LinearArcDisplay`** (Phase 2 target) to be the validation: no-arg
`configSchemaFactory()`, real slots, jexl reads. Converted, tsgo-clean, 10 tests
green. `never`-probe confirms `color`/`displayMode` reads are typed `string`
(not `any`) and validate against the full inherited schema; an invalid slot name
is a compile error.

### Slot value types derive from `defaultValue`, NOT the slot's `type` field
`SlotValueFromDef` (core `configuration/types.ts`) infers the value type from
`defaultValue`. Verified empirically:
- literal `string`/`number`/`boolean` defaults → that primitive (`number`
  default `5` → `number`; `'darkblue'` → `string`).
- **enum** slots widen to `string` (need `as TheUnion` at the read).
- **jexl-callback defaults** (`` `jexl:...` ``) widen to **`string`** — the
  slot's declared `type` (e.g. `'number'`) is erased and unrecoverable, and the
  jexl string is indistinguishable from a plain string default.

Consequence (corrects the Phase-2 assumption that "jexl slots return the slot's
declared type"): a **numeric** slot with a jexl default (arc's `thickness`,
`arcHeight`) mistypes to `string`. Routing it through typed `self.conf` then
breaks real numeric consumers (`Math.min`, `getBezierPath`). **Per-slot rule:**
type the string-valued reads through `self.conf`; leave numeric-jexl reads on the
untyped `getConf` (a `string`→`number` cast would need `as unknown as number` —
worse than `any`). String-typed jexl slots (arc's `label`/`caption`) derive
`string`, which is acceptable. This is a per-slot caveat, not a per-display
blocker — Phase 3 targets (canvas/wiggle) still benefit on their literal-default
slots.

### Converted so far
- **`LinearArcDisplay`** (Phase 1 validation) — `conf` getter; `color`/`label`/
  `caption`/`displayMode` typed via `self.conf`; `thickness`/`arcHeight` stay on
  `getConf` (numeric-jexl, see above).
- **`LinearPairedArcDisplay`** (Phase 2 sibling) — single `color` slot, typed via
  `self.conf`. Arc plugin fully converted, 10 tests green.
- **canvas `LinearBasicDisplay`** (Phase 3) — `conf` getter on the
  `LinearCanvasBaseDisplay` base (only consumer is the leaf `model.ts`, so safe
  to add there). Only **two** direct self-reads existed (`fetchSizeLimit`,
  `maxFeatureScreenDensity`) — both literal-number defaults, so `as number` casts
  dropped cleanly. **Note:** the bulk of canvas reads already go through
  `getConfWithOverride` (concretely typed via `ConfigOverrideMixin<…ConfigModel>`),
  so the direct-read `conf` getter is a small incremental win here, not the
  jackpot the plan implied — the override path already carried the typing. 297
  tests green.

### Full display landscape (direct `getConf(self)`/`readConfObject(self)` reads)
Surveyed every `Linear*Display`. Direct-read counts exclude `getConfWithOverride`
(separate, already-typed path) and reads off `self.parentTrack`/`self.adapterConfig`
(foreign config nodes).

| Display | direct | converted? | why |
| --- | --- | --- | --- |
| arc `LinearArcDisplay` | 6 | ✅ | 4 typed, 2 numeric-jexl left on getConf |
| arc `LinearPairedArcDisplay` | 1 | ✅ | color |
| canvas `LinearBasicDisplay` | 2 | ✅ | fetchSizeLimit, maxFeatureScreenDensity |
| maf `LinearMafDisplay` | 1 | ✅ | fetchSizeLimit (inherited) |
| wiggle `LinearWiggleDisplay` | 0 | n/a | all reads via getConfWithOverride (typed) |
| alignments `LinearAlignmentsDisplay` | 0 | n/a | all via getConfWithOverride (typed) |
| variants (3 displays) | 0 | n/a | no direct self-config reads |
| hic `LinearHicDisplay` | 0 | n/a | no direct self-config reads |
| gwas `LinearManhattanDisplay` | 1 | ⏭️ skip | only read is `ldAdapter` (sub-config → any) |
| synteny `LinearSyntenyDisplay` | 2 | ⏭️ skip | `assemblyNames`/`trackIds` are array slots → any |
| gccontent `LinearGCContentDisplay` | 3 | ⏭️ skip | `shared.ts` factory serves TWO schemas (config1/config2) — generic, can't benefit |

### Conclusion: the direct-read pattern is essentially exhausted by Phases 1–3
The high-value target the plan imagined ("dense `getConf(self,'slot')` reads, all
`any`") mostly **doesn't exist** on displays. The reasons reads are `any` split into:
- **override-mixin displays** (wiggle/alignments/canvas-mostly) already type their
  reads through `getConfWithOverride` + `ConfigOverrideMixin<ConcreteModel>` — the
  `conf` getter is a tiny incremental win at best (`key_pattern_getconfwithoverride_typing`).
- **remaining direct reads are non-scalar** (array/sub-adapter/frozen slots) which
  `SlotValueFromDef` degrades to `any` regardless — the getter buys nothing.
- **shared/multi-schema factories** (gccontent) can't be tightened.

Net: arc/canvas/maf were the genuine surface (converted); the rest are correctly
skipped. Future display typing leverage lives in the `getConfWithOverride` path,
not direct reads.

## Risks / watch-items
- **Generic factory param is load-bearing elsewhere.** Some displays are
  subclassed or the factory is reused with different schemas — check `index.ts`
  and any `stateModelFactory` re-exports before tightening. If a factory genuinely
  serves multiple schemas, leave it generic (it can't benefit) and skip.
- **Import cycles.** Use a type-only import of the schema type into `model.ts`.
  `configSchema.ts` must not import `model.ts` (it doesn't today).
- **getConfWithOverride is a separate path** — the `conf` getter does not change
  override reads; don't try to unify them.
- **No runtime change.** Reads still go through `readConfObject` (jexl-safe). The
  getter is pure typing. Tests should be unchanged.
- **Stop criterion per display:** if a display reads only `name`/`adapter`/frozen/
  fileLocation slots (all `any` regardless), the `conf` getter adds nothing —
  skip it (same rule as adapters with no scalar slots).

## Definition of done (phase-level)
tsgo clean for the plugin, tests green, redundant scalar annotations removed, and
at least one `never`-probe per display family confirming a representative read is
typed (not silently `any`). Update `CONFIG_TYPED_READS_NEXT_STEPS.md`'s
display section to point here and mark converted displays.
