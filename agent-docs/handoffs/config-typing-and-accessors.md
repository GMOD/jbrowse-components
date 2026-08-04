---
name: config-typing-and-accessors
description: How much of the config surface is actually type-checked (measured, 62%), why the obvious ways to measure it don't work, and the three-step plan for the accessor codegen that would close the rest. Read before touching getConf typing, adding a config accessor mixin, or starting the generated-accessors work.
---

# Config typing, and the 143 hand-written accessors

## Where it stands

Two commits landed:

- `be6d18b4a1` — scroll clamp, grow-mode height and the score axis became mixin
  hooks (`TrackHeightMixin.scrollableHeight`, `HeightModeMixin.growTargetHeight`,
  `ScoreScaleMixin`), plus two bugfixes and `assertDisplayContract`.
- `b5cdd334f0` — `scripts/audit-config-read-types.ts` and its baseline
  `scripts/configReadTypeGaps.txt`.

Nothing below is started. The plan in §"What to build" is the open decision.

## The measurement, so nobody re-derives it

Run `node scripts/audit-config-read-types.ts` (add `--write` to re-baseline).
Takes a full program load, about a minute.

**156 config reads in source return `any`, plus 165 in tests, out of 830 total
accessor calls.** So 62% of the surface is genuinely checked.

That number is load-bearing because **both halves of the safety go at once**. A
widened schema makes the value `any` *and* degrades `ConfigurationSlotName` to
`string`, so the slot name stops being checked — and a slot-name typo is the one
config mistake with no runtime diagnostic either: `setSlot` assigns to an
undeclared property, so nothing throws, nothing persists, and the matching read
keeps returning the default.

The 156 are three populations that want different things, and the baseline file
separates them:

- **mixins casting their own `self`** to a widened config holder. Load-bearing as
  written — a mixin cannot know the composing display's schema — and the case the
  codegen below exists to fix.
- **`frozen` / `maybeFrozen` slots**, `any` by design (the arbitrary-JSON escape
  hatch). Accepted; they will never leave the list.
- **factories that left `configSchema` at `AnyConfigurationSchemaType`**. One-line
  fix each.

## Three dead ends in building the detector — don't retry them

1. **The slot-name *parameter* type says nothing.** `SLOT` is inferred from the
   string literal at the call site, so the instantiated parameter is always that
   literal however wide the constraint behind it. A first pass using this
   reported 4 gaps out of 837 and looked like great news. It was measuring
   nothing.
2. **The config-node type says almost nothing.** `AnyConfigurationModel` is a
   real object type, not `any`, so a widened holder *looks* concrete. (Note
   `configTypeNarrowing.test.ts` does assert `Instance<IConfigurationReference<
   AnyConfigurationSchemaType>>` is `any` — that is the *reference wrapper*, a
   different type. Don't conflate them.) This pass reported 66.
3. **What works is the read's own return type.** `ConfigurationSlotValue` bottoms
   out at `any` for exactly the widened case, which is the same signal
   `configTypeNarrowing.test.ts` uses. `setConf` has no return and so no signal;
   it widens with its siblings, so counting the reads is enough.

**The mixin surface is genuinely unchecked, confirmed directly.** A
`@ts-expect-error` probe on the mixin idiom —
`getConf(confNode(self), 'definitelyNotASlotAnywhere')` — compiled clean
(`error TS2578: Unused '@ts-expect-error' directive`). If you doubt the audit,
reproduce with that probe rather than by reading types in an editor, where the
hover looks fine.

## The other measurement: 143 pure passthroughs

Members of the exact shape `get x() { return getConf(self, 'x') }` /
`setX(v) { setConf(self, 'x', v) }`, i.e. nothing but plumbing:

| file | getters | setters |
| --- | --- | --- |
| `alignments/LinearAlignmentsDisplay/model.ts` | 27 | 23 |
| `maf/LinearMafDisplay/stateModel.ts` | 19 | 19 |
| `variants/shared/MultiSampleVariantBaseModel.ts` | 11 | 8 |
| `wiggle/shared/WiggleScoreConfigMixin.ts` | 9 | 7 |
| `wiggle/MultiLinearWiggleDisplay/model.ts` | 4 | 4 |
| `canvas/LinearMultiRowFeatureDisplay/model.ts` | 3 | 4 |
| `canvas/LinearBasicDisplay/baseModel.ts` | 1 | 4 |
| **total** | **74** | **69** |

Roughly a third of the config members in those files; the rest do real work
(`normalizeColorBy(resolveConf(…))`, `!!getConf(…)`, `?? self.isChainMode`,
setters that tie two slots) and must stay hand-written. **Two are aliased** and
any generator has to handle it: `configuredFeatureHeight` reads the
`featureHeight` slot, `renderingType` reads `defaultRendering`.

## Nine display factories are widened

26 grep hits for `configSchema: AnyConfigurationSchemaType`, but ten are the
pluggable-element registries (`DisplayType`, `TrackType`, …) which are correctly
widened — a registry holds any schema. The real ones:

`LinearWiggleDisplay`, `LinearBasicDisplay/model.ts`, `LinearVariantDisplay`,
`LinearSyntenyDisplay`, `DotplotDisplay`, `LDDisplay`, and gccontent's
`shared.tsx` / `stateModelTrack.ts` / `stateModelReferenceSequence.ts`.

Each is one line: name the concrete `ReturnType<typeof configSchemaFactory>` the
way alignments and MAF already do. This is the lever
[CONFIG_PATTERN.md](../reference/CONFIG_PATTERN.md) §"Read type narrowing"
prescribes.

## What to build

### 1. Narrow those nine factories — first, and on their own

Not because it is the biggest win but because **narrowing a widened schema
surfaces whatever latent errors were hiding behind it**, and you want that answer
before building anything on top of the assumption that the typing is sound. Land
them as nine separate commits so a bad one reverts cleanly, and budget a tail on
each.

### 2. The accessor codegen

Generated source, not a runtime `confGetters` helper. The reason is not
"gymnastics": a runtime helper can only live inside a mixin (where the schema is
widened, so it inherits the exact hole above) or inlined per display (where it
saves nothing). **Generated next to the display's own `configSchema.ts`, the
module can name the concrete schema — the one thing a shared mixin can never
do.** It also keeps the autogen model docs working, since the api-docs extractor
is AST-driven off `#getter`/`#action` tags and generated members are real
members.

Opt in from the slot itself, so there is no second list to drift:

```js
showCoverage: { type: 'boolean', defaultValue: true, accessor: true },
featureHeight: { type: 'maybeNumber', promotedBase: 7, promotable: true,
                 accessor: 'configuredFeatureHeight' },  // aliased
```

The generator emits `<Display>/configAccessors.generated.ts`: an MST mixin with
real `get x()` / `setX()` members typed against the concrete schema, picking
`getConf` vs `resolveConf` from `promotable`, carrying the slot's own
`description` as JSDoc. Precedent for the whole shape — `*.generated.ts`, "never
hand-edit", a dedicated CI staleness job — is the shader pipeline.

**Build the collision check before the generator, not after.** A generated name
silently shadowing a hand-written one is the failure mode, and `featureHeight` is
the live example: the slot exists, but the model's `featureHeight` getter is the
fit-squeezed value and only `configuredFeatureHeight` is the raw read. Emitting
`featureHeight` would shadow it with no error anywhere. Comparing emitted names
against the model file's AST closes it mechanically.

**Calibrate the payoff.** ~1000 lines deleted and the drift-proofing (setter
names and value types derived rather than restated) are the main event. The
typing win is real but modest: roughly 30 of the 156, because the 143
passthroughs mostly live in displays that are *already* concrete.

### 3. Then unify the fetch foundations

`installFetchAutorun(self, { deps, shouldFetch, run })` reading `deps()`
unconditionally, with `SignatureFetchMixin` folding synteny/dotplot onto
`FetchMixin` — [TODO.md](../TODO.md) §"Fold the non-LGV fetches onto `FetchMixin`"
specs the second half. Largest remaining structural debt, and the only item here
that has already shipped bugs (arc's dead `reload()`; the `isCacheValid`
short-circuit that works by accident). It is a project across 12+ displays, not a
follow-on to a typing change.

## Decisions left open

- **Where the prose goes.** Many of the 143 carry JSDoc explaining the promotable
  cascade, which the slot `description` does not. Most of it arguably belongs in
  the schema (one source, and it already renders on the config page); some is
  genuinely model-side and would need a per-slot override in the generator input.
  Nobody has read through all 143 to decide the split.
- **"Go to definition" landing in a generated file.** Already true for shaders;
  accepted there, unlitigated here.
- **Whether the mixins should be generated per display instead of shared.** That
  is what moves their ~30 unchecked reads, but it un-shares
  `WiggleScoreConfigMixin` / `ScoreScaleMixin`, which were *just* consolidated in
  `be6d18b4a1`. The tension is real and unresolved: consolidating into a mixin
  trades duplication for type safety, and this session did that trade in one
  direction without noticing it was a trade.

## Two things left unverified in `be6d18b4a1`

- **No browser check.** Typecheck, 4582 tests and lint pass, but that commit
  moved the alignments canvas 2px (`view.width` → `view.trackWidthPx`) and
  rewired when a tooltip clears. The existing browser gate is a canvas-vs-GPU
  *differential* check, so it is structurally blind to a width change both
  backends read identically — what would validate it is launching the app with
  track outlines on and off and looking.
- **`HeightModeMixin()` must compose after `TrackHeightMixin()`** (it overrides
  `height` and `resizeHeight`, and `types.compose` gives the later argument the
  collision). That is a *new* instance of the silent-ordering class, added by
  that commit, and unlike the canvas gate mixin it has no opt-in flag to read
  back, so `assertDisplayContract` can't check it. Listed in
  [ARCHITECTURAL_LIMITS.md](../reference/ARCHITECTURAL_LIMITS.md) §"Ordering is
  the contract".
