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
        ...self.configOverrides,
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
