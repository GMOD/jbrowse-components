---
status: Accepted
summary: "Slot-name safety is a runtime guard on the single write funnel, not codegen extending a compile-time guard that structurally cannot cover the surface"
---

# ADR-052: Slot-name safety is a runtime guard on `setSlot`, not generated accessors

## Status

Accepted (2026-08). Supersedes the accessor-codegen plan that the
`config-typing-and-accessors` handoff carried; that handoff is deleted and this
ADR is the record. The work is `258a85a4c2` (the guard), `c1a2d3af2f` /
`dc6cac4b39` / `a28bf168fc` (the narrowings), and `b5cdd334f0` (the audit the
whole thread was measured against).

## Context

Reading and writing a config slot goes through four functions —
`getConf` / `resolveConf` (read), `setConf` → `setSlot` (write) — and each
carries a compile-time guard on the slot name, keyed off the schema type:

```ts
SLOT extends ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>
```

When the schema is concrete, this is real safety: a misspelled slot name is a
compile error and the value comes back correctly typed. When the schema is
widened to `AnyConfigurationSchemaType`, **both halves go at once** —
`ConfigurationSlotValue` bottoms out at `any` and `ConfigurationSlotName`
degrades to `string`, so the name stops being checked too.

`scripts/audit-config-read-types.ts` measures how much of the surface actually
reaches the concrete case: **62%**, baselined in `scripts/configReadTypeGaps.txt`.

The 38% is not a backlog. It is structural, in four distinct ways:

- **A mixin cannot name the composing display's schema.** It composes *onto* a
  display that declares `configuration`, so its own `self` is not typed with it,
  and it casts (`self as { configuration: AnyConfigurationModel }`). Generic
  threading does not rescue this: inside a generic body the type variable is
  known only by its constraint, so `ConfigurationSlotName<…>` either hits the
  `IsAny` widen or won't resolve at all. Recorded in
  `packages/core/src/configuration/CLAUDE.md`; `TrackHeightMixin` still carries
  a vestigial `TConf` parameter that would not help if a caller passed one.
- **A widened `baseConfiguration` poisons the whole schema**, since
  `ConfigurationSlotName` recurses through `GetBase`. A schema taking its base
  from `pluginManager.getDisplayType(…).configSchema` has unchecked reads of its
  *own* slots, with no downstream annotation able to recover them.
- **The pluggable-element registries are correctly widened.** `DisplayType`,
  `TrackType` and friends hold any schema; that is what they are for.
- **`frozen` / `maybeFrozen` slots are `any` by design** — the arbitrary-JSON
  escape hatch.

So the compile-time guard is off for roughly a third of the surface, cannot tell
you when it is off (the widened case still hover-inspects as a real object type,
and a `@ts-expect-error` probe on the mixin idiom compiles clean), and needs a
full-program audit script to observe.

What made this feel urgent is the specific failure it was protecting against.
`setSlot` was a bare assignment:

```ts
setSlot(slotName: string, value: unknown) {
  self[slotName] = value
}
```

A misspelled name landed on an undeclared property: nothing threw, nothing
persisted, and the matching read went on returning the default. That is the one
config mistake with no diagnostic at any layer.

The plan that followed from this was an accessor codegen — a generator emitting
`<Display>/configAccessors.generated.ts`, an MST mixin of real `get x()` /
`setX()` members typed against the concrete schema, opted into from the slot
(`accessor: true`), replacing 143 hand-written passthroughs. Generated next to
the display's own schema, such a module *can* name the concrete type, which is
the one thing a shared mixin can never do.

## Decision

**Guard the write at runtime, at the single funnel every write already goes
through. Accept the residual unchecked reads. Do not generate accessors.**

`setSlot` now checks membership against the `modelDefinition` already in its
closure, mirroring what `setSubschema` does ten lines above it:

```ts
if (!Object.hasOwn(modelDefinition, slotName)) {
  throw new Error(`${modelName} has no config slot "${slotName}". …`)
}
```

`modelDefinition` has base-schema slots merged in by `mergeSchemaDefinition`, so
inherited slots pass. The check is `Object.hasOwn` rather than `in` so an
`Object.prototype` member is not mistaken for a slot. Both are covered by tests
in `configurationSchema.test.ts`.

### Why the write, and why that is enough

The four cases are not symmetric, and seeing them laid out is what settles it:

| | slot name | value type |
| --- | --- | --- |
| **write** | runtime guard (this ADR) | already runtime — MST type-checks the assignment |
| **read** | compile-time only, ~62% | compile-time only, ~62% |

Both write cases are now covered at runtime, on 100% of the surface, regardless
of whether the schema is widened. The compile-time machinery's unique residual
value is catching a typo'd slot name **on a read** — where the failure is a
silent `undefined` rather than a silent non-persisting write.

**The read path cannot take the same guard.** It was tried and reverted: reading
a slot off an un-hydrated plain config is legitimate and load-bearing —
`generateHierarchy` walks the frozen `jbrowse.tracks` that way rather than
hydrate 10k tracks for the track selector — and at runtime that is
indistinguishable from the broken spelling
([CONFIG_PATTERN.md](../reference/CONFIG_PATTERN.md)). That revert is about a
*different* check and should not be cited against the write-side one: a write
always targets a live MST node, so it has no snapshot ambiguity.

### Why not the accessor codegen

Four reasons, in descending order of how much they should stop a revival:

1. **It answers a mixin type hole by making the mixin layer bigger.** Mixins
   have two failure modes here. Type erasure is the enumerated, baselined,
   CI-gated one. The other is that `types.compose` resolves a member collision
   by *argument position* — `HeightModeMixin` must compose after
   `TrackHeightMixin`, which `no-restricted-syntax` now fails within one
   `types.compose` call and nothing catches across two. A generator
   emitting a getter per flagged slot is a collision generator by construction.
   The proposed guard — compare emitted names against the model file's AST —
   catches same-file shadowing but not collision with another mixin in the
   chain. `height` is the live example: the slot exists, `TrackHeightMixin`
   reads it, `HeightModeMixin` overrides the getter, and a generated third would
   win or lose on argument order alone.
2. **The deletion target and the typing target barely overlap.** ~30 of the
   unchecked reads, against 143 passthroughs that mostly live in displays which
   are *already* concrete — where the slot name is already checked, so a
   passthrough there cannot drift silently.
3. **A pure passthrough is the one member shape that cannot hide a bug.** ~1000
   deleted lines of the safest code in the repo, bought with a generator, a CI
   staleness job, a collision checker, and a per-slot JSDoc override mechanism.
4. **Where the prose goes was never scoped.** Many of the 143 carry JSDoc
   explaining the promotable cascade, which the slot `description` does not.
   Deciding the split means reading all 143 — most of the actual work, and it
   was listed as an open question.

### What is still worth doing

Naming a concrete schema in a state model factory
(`packages/core/src/configuration/CLAUDE.md` §"Read type narrowing")
remains the right lever where it is cheap, and importing a base schema directly
rather than through the registry is a genuine fix. Both were applied. But
calibrate: doing this across the nine widened display factories moved the audit
by **6 reads**, and the overall number barely moved (61% → 62%).

Two reasons the yield was that low, both worth knowing before estimating similar
work:

- **Several displays' gaps are reads against the *track* schema**
  (`readConfObject(track, 'trackId' | 'assemblyNames')`,
  `getConf(self.parentTrack, 'adapter')`). No display narrowing can reach them,
  and the baseline groups by file, which hides this. `LinearBasicDisplay` is
  left widened for exactly this reason.
- **gccontent's base came out of the plugin registry**, so its own slots were
  unchecked and no factory annotation could have fixed it. That had to be
  re-plumbed before any of the "one line" changes applied.

## Consequences

- **`setSlot` throws.** Don't weaken it to a warning; the failure it replaces
  was silent at every layer. The config editor's slot facade
  (`getSlotDefinition`) and `tracks.ts` (`isConfigurationSlot`) already only
  pass real names, so the guard is not on a dynamic-name path.
- **It fires on nothing today** — 10,889 tests, zero hits. This is a guard
  against the next typo, not a fix for a live bug, which also says the bug class
  was more theoretical than the framing around it suggested. If it ever does
  fire in the wild, that is the signal to revisit how much the read-side
  compile-time guard is worth.
- **The ~30 unchecked mixin reads are accepted.** Enumerated in
  `scripts/configReadTypeGaps.txt`, gated in CI, confined to four heavily
  commented files. A managed risk, not a leak. Don't re-open this by proposing
  per-display generated mixins — that un-shares `WiggleScoreConfigMixin` /
  `ScoreScaleMixin`, which `be6d18b4a1` had just consolidated.
- **The audit script and its baseline stay.** Their value is now diagnostic —
  telling you whether narrowing a particular factory would buy anything — rather
  than a number to drive toward. 62% is close to the ceiling this design allows.
- **The general principle**: when a compile-time guard is structurally unable to
  cover a surface, and the surface has a single runtime funnel, guard the
  funnel. Extending the compile-time guard by generating code is the more
  expensive answer and, here, the one that grows the failure mode nobody checks.
- If a mechanical check for `types.compose` ordering collisions is ever found,
  it is worth more than any of the typing work in this thread, and it would also
  remove the first objection to codegen. Recorded alongside the other
  unprotected-correctness items in
  [ARCHITECTURAL_LIMITS.md](../reference/ARCHITECTURAL_LIMITS.md).
