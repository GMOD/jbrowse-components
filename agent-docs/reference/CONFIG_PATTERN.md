---
name: config-pattern
description: How display config reaches the renderer, from config to MST snapshot to plain object to RPC payload. Read when touching config, JEXL callbacks, or RPC payloads.
---

# Display Config Pattern

How display settings flow from MST model → rendering code (GPU/Canvas2D/worker).
MST confined to main thread; renderers work on plain objects.

## Overview

Pipeline: MST config model → plain snapshot → rendering code. No MST at render
layer.

## The pattern

### Main thread: produce a plain config object

The display config snapshot is built inline inside `rpcProps()` (the single
RPC payload extension hook — see `ARCHITECTURE.md` §"`rpcProps()` /
`gpuProps()` pattern"). Subclasses that need to layer fields onto
`displayConfig` extend `rpcProps()` via super-capture and spread:

```ts
// Base view: assemble the snapshot once, inside rpcProps()
.views(self => ({
  rpcProps() {
    return {
      adapterConfig: self.adapterConfigSnapshot,
      displayConfig: {
        ...getConfSnapshot(self.configuration),
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

`getConfSnapshot()` returns ALL config values including defaults (unlike
`getSnapshot()` which strips defaults via `postProcessSnapshot`). JEXL callback
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
(`self.configuration.setSlot(key, value)`) and reads it back through `getConf` /
`getConfSnapshot`. There is no separate override map: the earlier
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
  promotable-slot mechanism / `getConfResolved` rather than a shadow property.
- **Bespoke MST prop** — only for state that isn't a config slot (an ephemeral
  volatile, or a sentinel like `rowHeight === 0` = fit-to-height). When a prop
  encodes a sentinel, expose the resolved value under a distinct getter
  (`effectiveRowHeight`) and make every consumer read that, never the raw prop.

The wholesale `displayConfig: { ...getConfSnapshot }` form above ships every slot
to the worker (canvas/wiggle); alignments instead curates a narrow `rpcProps()`
so visual-only changes don't refetch (its CLAUDE.md §"Settings: storage +
invalidation tiers").

## Key functions

| Function                                | Location                                                  | Purpose                                                   |
| --------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| `getConfSnapshot(config)`               | `packages/core/src/configuration/util.ts`                 | Snapshot with defaults included, JEXL strings preserved   |
| `readConfigValue(config, key, feature)` | `packages/core/src/configuration/util.ts`                 | Read from plain object, auto-evaluate JEXL                |
| `createRenderConfigContext(config)`     | `plugins/canvas/src/RenderFeatureDataRPC/renderConfig.ts` | Extract frequently-accessed fields for the rendering loop |

## What this replaces

| Old pattern                                                     | New pattern                                      |
| --------------------------------------------------------------- | ------------------------------------------------ |
| `readConfObject(mstModel, key, { feature })` in workers         | `readConfigValue(plainObj, key, feature)`        |
| `configSchema.create(snapshot, { pluginManager })` re-hydration | Not needed — plain objects work directly         |
| `CachedConfig<T>` / `readCachedConfig()` indirection            | Removed — `readConfigValue` is simple and direct |
| Hardcoded `mockConfig` with fallback defaults                   | `getConfSnapshot` includes real values           |
| Nested `renderer: { type: "X", color1: "..." }` in config       | Direct `color1: "..."` on display config         |

## Adoption

- **Canvas** (LinearFeatureDisplay, LinearBasicDisplay, LinearVariantDisplay):
  fully adopted
- **Wiggle, alignments, multi-variant**: direct config slots, main-thread render
- **Arc, chord, HiC, dotplot**: still using ServerSideRendererType —
  adopt on GPU migration

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

- **TrackConfigurationReference** resolves through `session.tracksById`,
  falling back to MST `resolveIdentifier`, and the return is a
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

Simplifying either of the TrackConfigurationReference quirks requires first
migrating view-local configs into the session.
