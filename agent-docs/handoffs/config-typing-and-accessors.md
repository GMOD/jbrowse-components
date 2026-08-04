---
name: config-typing-and-accessors
description: What the config-typing thread actually found on contact — the nine "one-line" factory narrowings yielded 6 gaps of 156, the accessor codegen is cancelled and why, and the runtime guard that replaced the argument. Read before touching getConf typing, adding a config accessor mixin, or reviving the generated-accessors idea.
---

# Config typing: what the measurement was worth

## Where it stands

The thread is **closed**, with a different answer than the plan it started from.
Five commits:

- `be6d18b4a1` — scroll clamp, grow-mode height and the score axis became mixin
  hooks (`TrackHeightMixin.scrollableHeight`, `HeightModeMixin.growTargetHeight`,
  `ScoreScaleMixin`), plus two bugfixes and `assertDisplayContract`.
- `b5cdd334f0` — `scripts/audit-config-read-types.ts` and its baseline
  `scripts/configReadTypeGaps.txt`.
- `258a85a4c2` — the `setSlot` runtime guard.
- `c1a2d3af2f`, `dc6cac4b39`, `a28bf168fc` — the factory narrowings.

**The accessor codegen is cancelled.** Reasoning below; don't revive it without
reading it.

## The measurement still stands, and still means what it said

Run `node scripts/audit-config-read-types.ts` (add `--write` to re-baseline).
Full program load, about a minute. Now **150 unchecked in source** (+165 in
tests) of 833 accessor calls.

The three dead ends in *building* the detector are unchanged and still worth not
retrying: the slot-name parameter type says nothing (it is inferred from the call
site literal), the config-node type says almost nothing
(`AnyConfigurationModel` is a real object type, so a widened holder looks
concrete), and only the read's own return type carries the signal. If you doubt
the audit, reproduce with a `@ts-expect-error` probe on the mixin idiom rather
than by hovering types in an editor, where it looks fine.

## What the nine factory narrowings were actually worth

The prior version of this document said nine widened display factories were
"each one line". On contact:

| factory | gaps closed | why |
| --- | --- | --- |
| `LinearWiggleDisplay` | 3 | `color`, `useBicolor`, `minimalTicks` |
| gccontent ×3 | 3 | `windowSize`, `windowDelta`, `gcMode` |
| `DotplotDisplay` | 0 | model reads no config of its own |
| `LinearSyntenyDisplay` | 0 | its 1 gap is `getConf(self.parentTrack, 'adapter')` |
| `LDDisplay` | 0 | shared model factory already took the concrete type |
| `LinearVariantDisplay` | 0 | reads no config of its own |
| `LinearBasicDisplay` | 0 | left widened, see below |

**6 of 156.** The five zero-yield ones were still landed, as upkeep so the next
config read added to those models is checked — but they are upkeep, not fixes,
and the commits say so.

Two things the "one line each" framing got wrong, both worth internalizing
before trusting a similar estimate:

- **`LinearBasicDisplay`'s four gaps are `readConfObject(track, 'trackId' |
  'assemblyNames')`** — reads against the *track* schema. Narrowing the display
  factory cannot reach them. Same for synteny's single gap. A per-display gap
  count is not the same as a count of gaps a *display* narrowing can close, and
  the baseline file groups by file, which hides this.
- **gccontent was blocked by something the plan never modelled.**
  `sharedGCContentConfigSchema` took its `baseConfiguration` from
  `pluginManager.getDisplayType('LinearWiggleDisplay').configSchema`. That is
  the identical object the wiggle plugin exports — it registers the same
  module-level const — but the registry field is typed
  `AnyConfigurationSchemaType`, correctly, since a registry holds any schema.
  **A widened base poisons the whole schema**, because `ConfigurationSlotName`
  recurses through `GetBase`, so gccontent's own `windowSize`/`windowDelta`/
  `gcMode` reads were unchecked and no annotation downstream could recover them.
  Fixed in `dc6cac4b39` by importing the schema directly. If another plugin ever
  extends a schema it reaches through the registry, it inherits this silently.

Also confirmed while doing it: pinning a shared base makes a subclass's own-slot
reads a hard error, and the fix is the documented one — redeclare
`configuration: ConfigurationReference(configSchema)` in the subclass's
`types.compose`, which overrides props and costs nothing at runtime.
`SharedGCContentModel` is now the worked example.

## Why the accessor codegen is cancelled

The plan was a generator emitting `<Display>/configAccessors.generated.ts` — an
MST mixin of real `get x()` / `setX()` members typed against the concrete schema
— opted into from the slot (`accessor: true`), replacing 143 hand-written
passthroughs. Four reasons it is not worth building:

1. **It would fix the type hole in the mixin layer by making the mixin layer
   bigger.** Mixins have two failure modes here. Type erasure is the enumerated,
   baselined, CI-gated one. The other is that `types.compose` resolves a member
   collision by *argument position* — `HeightModeMixin` must compose after
   `TrackHeightMixin`, nothing checks it, and `assertDisplayContract` structurally
   cannot. A generator emitting a getter per flagged slot is a collision
   generator by construction, and the proposed guard (compare emitted names
   against the model file's AST) catches same-file shadowing but *not* collision
   with another mixin in the chain. `height` is the live example: the slot
   exists, `TrackHeightMixin` reads it, `HeightModeMixin` overrides the getter,
   and a generated third would win or lose on argument order alone.
2. **The payoff and the deletion target barely overlap.** ~30 of 156 reads, and
   the 143 passthroughs mostly live in displays that are *already* concrete —
   where the slot name is already checked, so a passthrough there cannot drift
   silently. The drift-proofing argument applies mainly where the typing already
   works.
3. **A pure passthrough is the one member shape that cannot hide a bug.** ~1000
   deleted lines of the safest code in the repo, bought with a generator, a CI
   staleness job, a collision checker, and an unresolved per-slot JSDoc override
   mechanism.
4. **Nobody had read the 143 to decide where the prose goes.** That was listed
   as an open question; it is most of the actual work.

The residual ~30 unchecked mixin reads are **accepted**. They are enumerated in
`scripts/configReadTypeGaps.txt`, gated in CI, and live in four heavily
commented files. That is a managed risk, not a leak.

The premise the plan rested on is sound and worth not re-testing: a shared mixin
genuinely *cannot* name the composing schema. Generic threading does not rescue
it — inside a generic body the type variable is known only by its constraint, so
`ConfigurationSlotName<…>` either hits the `IsAny` widen or won't resolve at
all. See `packages/core/src/configuration/CLAUDE.md`. `TrackHeightMixin` still
carries a vestigial `TConf` parameter no caller passes; it would not help if one
did.

## What replaced it: guard the write at runtime

The argument for all of this was that a slot-name typo is silent at every layer.
That was true of the **write** path and is now fixed in five lines
(`258a85a4c2`): `setSlot` was a bare `self[slotName] = value`, so a typo landed
on an undeclared property — nothing threw, nothing persisted, the matching read
kept returning the default. It now throws on a name the schema doesn't declare,
using the `modelDefinition` already in closure scope, mirroring the check
`setSubschema` does ten lines above.

This covers **100% of writes** regardless of whether the schema is widened,
which is the thing the type layer structurally cannot do.

Three facts that make the tradeoff legible:

- **A wrong slot *value* type already throws at runtime** — MST type-checks the
  assignment (`getConf.ts`). So the compile-time machinery's unique residual
  value is catching a typo'd slot name **on a read**.
- **The read path cannot take the same guard.** It was tried and reverted:
  reading a slot off an un-hydrated plain config is legitimate and load-bearing
  (`generateHierarchy` walks 10k frozen track configs that way) and at runtime is
  indistinguishable from the broken spelling. See CONFIG_PATTERN.md. That is a
  *different* check from the write-side one — don't cite the revert against it.
- **The guard fires on nothing today.** 10,889 tests, zero hits. It is a guard
  against the next typo, not a fix for a live bug — which also says the bug class
  was more theoretical than the framing suggested. The three dynamic call sites
  were checked by hand: `tracks.ts` already gates on `isConfigurationSlot`, the
  config editor's slot facade builds from `getSlotDefinition`, and the variants
  display-switch ports keys that all live on the shared base schema.

## Still open

### Unify the fetch foundations — the item that should have been first

`installFetchAutorun(self, { deps, shouldFetch, run })` reading `deps()`
unconditionally, with `SignatureFetchMixin` folding synteny/dotplot onto
`FetchMixin` — [TODO.md](../TODO.md) §"Fold the non-LGV fetches onto `FetchMixin`"
specs the second half. Largest remaining structural debt, and **the only item in
this thread that has already shipped bugs** (arc's dead `reload()`; the
`isCacheValid` short-circuit that works by accident). A project across 12+
displays. It was listed third behind two typing changes it never depended on.

### Two things left unverified in `be6d18b4a1`

- **No browser check.** Typecheck, tests and lint pass, but that commit moved the
  alignments canvas 2px (`view.width` → `view.trackWidthPx`) and rewired when a
  tooltip clears. The browser gate is a canvas-vs-GPU *differential* check, so it
  is structurally blind to a width change both backends read identically. What
  validates it is launching the app with track outlines on and off and looking.
  **The committed image snapshots are stale against this** — 40 of them fail on
  a pure 808→806 width diff. Regenerating them is a separate, deliberate act;
  don't fold it into an unrelated commit.
- **`HeightModeMixin()` must compose after `TrackHeightMixin()`.** A new instance
  of the silent-ordering class, with no opt-in flag for `assertDisplayContract`
  to read back. Listed in
  [ARCHITECTURAL_LIMITS.md](../reference/ARCHITECTURAL_LIMITS.md) §"Ordering is
  the contract". If anyone finds a mechanical check for compose-order collisions,
  that is worth more than any of the typing work in this thread.
