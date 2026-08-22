---
name: config-pattern
description: How display config reaches the renderer, from config to MST snapshot to plain object to RPC payload. Read when touching config, JEXL callbacks, or RPC payloads.
---

# Display Config Pattern

How display settings flow from MST model → rendering code (GPU/Canvas2D/worker).
MST confined to main thread; renderers work on plain objects.

## The pattern

### Main thread: produce a plain config object

The display config snapshot is built inline inside `rpcProps()` (the single
RPC payload extension hook — see `ARCHITECTURE.md` §"`rpcProps()` /
`gpuProps()` pattern"). Subclasses that need to layer fields onto
`displayConfig` extend `rpcProps()` via super-capture and spread:

`getConfigSnapshotWithPromotables(self)` is the one snapshot helper the
`@jbrowse/core/configuration` barrel exports, because a display's `promotable`
slots resolve against the session at read time and a raw snapshot would ship
their bare inherit sentinels (see
[DISPLAY_TYPE_DEFAULTS.md](DISPLAY_TYPE_DEFAULTS.md) §"Serialization
boundaries"). It takes the display **state node**, not the bare config.

```ts
// Base view: assemble the snapshot once, inside rpcProps()
.views(self => ({
  rpcProps() {
    return {
      adapterConfig: self.adapterConfigSnapshot,
      displayConfig: {
        ...getConfigSnapshotWithPromotables(self),
      } as DisplayConfig,
      // ...
    }
  },
}))

// Subclass: extend via super-capture
.views(self => {
  const { rpcProps: superRpcProps } = self
  return {
    rpcProps() {
      const base = superRpcProps()
      return {
        ...base,
        displayConfig: {
          ...base.displayConfig,
          geneGlyphMode: self.effectiveGeneGlyphMode,
        } as DisplayConfig,
      }
    },
  }
})
```

Both snapshot helpers return ALL config values including defaults (unlike
`getSnapshot()`, which strips defaults via `postProcessSnapshot`). JEXL callback
values are preserved as raw `"jexl:..."` strings.

### Rendering code: read values with JEXL support

```ts
import { readConfigValue } from './renderConfig.ts'

// Simple value:
const height = readConfigValue<number>(config, 'featureHeight', feature)

// JEXL callback (evaluated per-feature automatically):
const color = readConfigValue<string>(config, 'color1', feature)

// Nested key:
const fontSize = readConfigValue<number>(
  config,
  ['labels', 'fontSize'],
  feature,
)
```

`readConfigValue` detects `"jexl:..."` strings and evaluates them via
`stringToJexlExpression`. Non-JEXL values are returned directly. No MST model
needed — works on plain objects.

### Config schema: define settings on the display

Visual settings live directly on the display config schema, not nested inside a
renderer sub-config:

```ts
ConfigurationSchema('MyDisplay', {
  color1: {
    type: 'color',
    defaultValue: 'goldenrod',
    contextVariable: ['feature'], // enables jexl callbacks
  },
  featureHeight: {
    type: 'number',
    defaultValue: 10,
    contextVariable: ['feature'],
  },
  // ...
})
```

### Backward compatibility

`baseTrackConfig.ts` `preProcessSnapshot` promotes old renderer → display-level
properties. Old configs work without migration.

**Type-changed slots need converting, not just lifting.** When a slot's type
changes (e.g. `showLabels` went from `boolean` to a `stringEnum` of
`auto`/`on`/`off`), `preProcessSnapshot` must convert the old value, otherwise
the lifted/legacy value fails schema validation. Keep the conversion + the enum
values + the type in one module so the schema, the model getter, the menu, and
the snapshot migration can't drift — see
`plugins/canvas/src/LinearBasicDisplay/showLabelsMode.ts` (`SHOW_LABELS_MODES`,
`ShowLabelsMode`, `legacyShowLabelsToMode`), consumed by `baseConfigSchema.ts`'s
renderer-lift, `migrateBasicSnapshot.ts`, and `baseModel.ts`.

**Every config schema must be `explicitlyTyped`** (gives it a
`type: types.optional(types.literal(name), name)` discriminator). The track /
display / adapter unions (`pluginManager.pluggableConfigSchemaType`) are plain
`types.union(...)` with no dispatcher, so MST relies on that literal `type` to
pick the member. Without it — or when a member's value is wrong — a single bad
field made MST report *every* member's full structure ("No type is applicable
for the union", dozens of lines).

`@jbrowse/mobx-state-tree@5.10.0` fixes that wall: it scopes the validation
error to the single member whose literal `type` matches the snapshot. The
scoping drills through the wrapper layers `ConfigurationSchema()` builds —
`ConfigurationSchema()` returns `optional(model)` (this fork bakes
`pre`/`postProcessSnapshot` into the `ModelType` itself, so members are
`optional(model)`, not `optional(snapshotProcessor(model))`); the unwrapper also
handles `snapshotProcessor()`/`refinement()`/`late()` for non-config unions.

If you still see the wall, the offending member either isn't `explicitlyTyped`,
its `type` literal doesn't match the snapshot, or the union mixes in an untagged
catch-all member (one whose `type` is a plain string rather than a literal) — in
that case MST can't prove the discriminator match is unique and falls back to
validating every member.

## Runtime setting changes (write the slot directly)

A runtime UI change to a display setting writes the **config slot itself**
(`setConf(self, key, value)`) and reads it back through `getConf` (or
`resolveConf` for a promotable slot). There is no separate override map: the
earlier
`ConfigOverrideMixin` (a `configOverrides` frozen map with `getConfWithOverride`
/ `getOverride` / `setOverride`) was collapsed. A setting's current value lives
in the slot, so the `displayConfig` snapshot above already reflects any runtime
change with no extra spread.

Where to put a new setting:

- **Config-backed setting** (the default for any display option) — add a slot to
  the display config schema, write it with `setSlot`, read it with `getConf`. It
  serializes into the session and can take a declarative config default.
- **Read-time default resolution** — when a value must resolve across tiers
  (config default → display-type/session default → per-instance pin), use the
  promotable-slot mechanism / `resolveConf` rather than a shadow property.
- **Bespoke MST prop** — only for state that isn't a config slot (an ephemeral
  volatile). A sentinel is not a reason to avoid a slot: `rowHeight === 0` =
  fit-to-height sits on a config slot in every display that has it. What a
  sentinel does require is a distinct resolved getter (`effectiveRowHeight`)
  that every consumer reads instead of the raw setting — see
  `ROW_HEIGHT_AND_FIT.md`.

The `getConfigSnapshotWithPromotables(self)` form above is canvas's, and canvas
does not ship what it returns: `pickDisplayConfig` takes exactly the slots
`DisplayConfig` declares back out of it, off a `Record<keyof DisplayConfig, true>`
the compiler proves complete in both directions. Everything else — alignments,
both wiggles, multi-row, Manhattan, HiC, MAF, LD, multi-sample variant —
enumerates its `rpcProps()` fields by hand, which is the same discipline reached
without the snapshot. `plugins/alignments/src/LinearAlignmentsDisplay/CLAUDE.md`
§"Which getter decides what a setting invalidates" is the worked account of why
visual-only changes must not refetch.

## Reading a slot: node, not snapshot

Every slot is `types.stripDefault(...)`, so a config snapshot **omits any slot
sitting at its default**. That keeps saved sessions minimal and is exactly right
for what snapshots are for — re-creating the object (the schema re-applies
defaults) and diffing what a user actually set. It is not a value-read API.

**The compiler owns this now, so it needs no vigilance.** A snapshot is not an
accepted argument to `readConfObject` — a compile error, guarded by
`configTypeNarrowing.test.ts`. So the spelling left is the correct one: drill from
the live node, which resolves defaults.

```ts
// resolves the adapter's default
readConfObject(getContainingTrack(self).configuration, ['adapter', 'fetchSizeLimit'])
```

Note the array path itself still returns `any` — only single-slot reads narrow.

**Don't add a runtime check on top.** It was tried and reverted: reading a slot off
an un-hydrated plain config is legitimate and load-bearing — `generateHierarchy`
walks the frozen `jbrowse.tracks` that way rather than hydrate 10k tracks for the
track selector — and at runtime that is indistinguishable from the broken
spelling.

Don't "fix" `readSlot` to return a defaults-included clone: it returns the cached
`getSnapshot` deliberately (stable identity, so downstream computeds memoize), and
a per-read built object was a measured perf and spurious-recomputation regression.
The story is in [HISTORICAL.md](HISTORICAL.md) §"A config snapshot was a legal
input to `readConfObject`".

## Forwarding a callback slot: read it raw, don't resolve it

[ADR-066](../architecture-decision-records/adr-066-callback-slots-are-read-raw-at-the-call-site.md)
is the decision behind this section, including the repo-wide fix that was built
and backed out. `pnpm check-deferred-slot-reads` ratchets it.

A wholesale snapshot never had to think about this. `fullConfSnapshot` reads raw
MST properties, so a `jexl:` slot is forwarded intact and the worker's
`readConfigValue` binds the feature — which is why canvas and wiggle, which ship
the whole snapshot, have never hit the trap below.

A display that curates its own `rpcProps()` slot by slot has to think about it,
because the obvious spelling is wrong:

```ts
// WRONG in a curated rpcProps(): resolves the callback here, on the main
// thread, against whatever context the read passes — which is none
get partitionField(): string {
  return readConfObject(self.conf, 'partitionField')
}

// RIGHT: a transport read. The worker binds `feature` and resolves it.
get partitionField(): string {
  return self.conf.partitionField
}
```

`readConfObject` / `getConf` / `resolveConf` take `args` as an **optional**
parameter, so "what is this setting" and "what is this setting FOR this feature"
are the same call with and without a third argument. Omit it on a callback slot
and the expression is evaluated anyway, against a context where every name it
mentions is `undefined`, and the fallout comes back as the setting. The two
spellings of that look nothing alike from the outside:

| slot | expression | arg-less read | symptom |
| --- | --- | --- | --- |
| `LinearManhattanDisplay.color` | `jexl:get(feature,…)` | throws `reading 'get'` | escapes the model getter, banners the display |
| `LinearMultiRowFeatureDisplay.partitionField` | `jexl:split(feature.name,…)` | `''`, because `split` is total | `''` ships as an attribute name; every feature lands in one unnamed row |

Both are pinned by canaries at the display — `colorSlotTransport.test.ts` and
`partitionFieldTransport.test.ts` — because there is nothing in the reader that
can catch this: an arg-less read is a legitimate operation on the many slots that
hold no callback.

**How to tell which kind of read you want:** does something downstream still bind
a feature? If the value is going into `rpcProps()`, a renderer, or anywhere the
worker will call `readConfigValue` on it, it is transport — read it raw. If it is
going into a swatch, a menu label, or arithmetic on the main thread, it is a
resolving read, and it needs either a feature in `args` or an `isJexl` guard.
`LinearBasicDisplay`'s `featureColor` / `utrColor` / `colorByMode` are the worked
examples of the second kind: raw read, `isJexl` guard, fall back to a default,
because no single swatch can show a per-feature expression.

Slots that can hold a callback are the ones declaring `contextVariable` — that is
what gates `SlotEditor`'s value/callback toggle. It is editor metadata only:
nothing in the read path consults it, so a slot that forgets to declare one is
still reachable by hand-writing `jexl:` into JSON. (`partitionField` had
forgotten, which is how it shipped broken.) Declare it so the editor works; don't
rely on it as a correctness signal.

## Key functions

| Function                                | Location                                                  | Purpose                                                   |
| --------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| `getConfigSnapshotWithPromotables(display)` | `packages/core/src/configuration/promotableDefaults.ts` | Snapshot with defaults included and every promotable slot resolved |
| `fullConfSnapshot(config)`              | `packages/core/src/configuration/fullConfSnapshot.ts`     | The walker under it. Not on the barrel — use the resolving form |
| `readConfigValue(config, key, feature)` | `packages/core/src/configuration/readConfObject.ts`       | Read from plain object, auto-evaluate JEXL                |
| `pickDisplayConfig(snapshot)`           | `plugins/canvas/src/RenderFeatureDataRPC/renderConfig.ts` | Take the worker's slots out of the snapshot — the pick, never a subtraction |

Canvas has its own `readConfigValue` beside those, plus a `readConfigValueSafe`;
they are the worker-side pair, and core's is the one a plugin outside canvas
reaches for.

## What this replaces

| Old pattern                                                     | New pattern                                      |
| --------------------------------------------------------------- | ------------------------------------------------ |
| `readConfObject(mstModel, key, { feature })` in workers         | `readConfigValue(plainObj, key, feature)`        |
| `configSchema.create(snapshot, { pluginManager })` re-hydration | Not needed — plain objects work directly         |
| `CachedConfig<T>` / `readCachedConfig()` indirection            | Removed — `readConfigValue` is simple and direct |
| Hardcoded `mockConfig` with fallback defaults                   | the real snapshot includes real values           |
| Nested `renderer: { type: "X", color1: "..." }` in config       | Direct `color1: "..."` on display config         |

## Which displays are on it

The pipeline is for a display whose worker reads config. That is every display
with an `rpcProps()`: canvas's three (`LinearBasicDisplay`,
`LinearVariantDisplay`, `LinearMultiRowFeatureDisplay`), alignments, both
wiggles, Manhattan, HiC, MAF, LD, multi-sample variant, and `LGVSyntenyDisplay`.

The rest have no worker config to send, which is a different shape rather than
an unfinished migration: **arc** and **circular-view**'s chords paint the live
view as main-thread SVG with every feature in one array, **dotplot** and
**synteny** own their fetch outside `FetchMixin` entirely
([SHARED_CANVAS_VIEWS.md](SHARED_CANVAS_VIEWS.md)), and
`LinearReferenceSequenceDisplay` deliberately omits `rpcProps()` so no
`SettingsInvalidate` is installed at all — see
[ARCHITECTURAL_LIMITS.md](ARCHITECTURAL_LIMITS.md) §"Ordering is the contract".

There is no server-side renderer left to migrate off. The renderer registry —
`ServerSideRendererType`, `FeatureRendererType`, `BoxRendererType`, `GlyphType`
— is gone, and `packages/core/src/ReExports/abiPreviousRelease.test.ts` records
each removal with its reason.

## Reference resolution (the other config concern)

The pipeline above is the render-data flow. Orthogonal to it is how state
models *reach* their config: every track / display state model holds its
config via `ConfigurationReference(schemaType)`, dispatched on the schema's
`explicitIdentifier`:

| `explicitIdentifier` | Branch                          |
| -------------------- | ------------------------------- |
| `'trackId'`          | `TrackConfigurationReference`   |
| `'displayId'`        | `DisplayConfigurationReference` |
| anything else        | plain `types.union(ref, schema)`|

Authoritative docs (with named canary tests) live alongside the code at
`packages/core/src/configuration/CLAUDE.md`. Highlights:

- **TrackConfigurationReference** resolves through `session.getTrackById(id)`
  (a per-id computed — resolving one track's config subscribes only to that
  id), falling back to MST `resolveIdentifier`, and the return is a
  `types.union(ref, schema)`. Both the fallback and the union exist for
  views that hold ephemeral track configs outside `session.tracks`
  (LinearSyntenyView, CircularView/SvInspectorView). Canaries:
  `ReadVsRef.test.tsx`, `SVInspector.test.tsx`.
- **DisplayConfigurationReference** resolves by displayId, then by
  `parent.type`. The type-match path always succeeds at runtime because
  `baseTrackConfig.preProcessSnapshot` injects a stub display entry for
  every registered displayType on the track.
- `ConfigurationReference`'s return is left unannotated. Adding
  `as SCHEMATYPE` narrows `SnapshotIn` to just the object branch and breaks
  string-id callers; the inferred union `SnapshotIn` is
  `string | SnapshotIn<schema>`.
- **A subclass that adds its own config slots must redeclare
  `configuration: ConfigurationReference(configSchema)` in its `types.compose`**,
  or `getConf` still types against the base factory's schema. `types.compose`
  **overrides** props rather than intersecting them (`_OverrideProps` in the MST
  typings), so the redeclaration costs nothing at runtime — same node either
  way — and buys own-slot narrowing. `showInsertionGlyphsSlot.test.ts` is the
  worked case, on `LinearMultiSampleVariantDisplay` against
  `SharedVariantConfigModel`.

Simplifying either of the TrackConfigurationReference quirks requires first
migrating view-local configs into the session.
