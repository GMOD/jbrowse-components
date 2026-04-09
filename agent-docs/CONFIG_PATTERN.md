# Display Config Pattern

## Overview

Display rendering config follows a simple pipeline: MST config model on the
main thread → plain object snapshot → rendering code (GPU, Canvas2D, or worker).
No MST dependency at the rendering layer.

## The pattern

### Main thread: produce a plain config object

```ts
// In the display model's views:
get displayConfigSnapshot() {
  return getConfSnapshot(self.configuration) as Record<string, unknown>
}

// When sending to the RPC or rendering:
const config = {
  ...self.displayConfigSnapshot,
  // Model overrides take precedence over config values
  displayMode: self.displayMode,
  geneGlyphMode: self.effectiveGeneGlyphMode,
}
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
const fontSize = readConfigValue<number>(config, ['labels', 'fontSize'], feature)
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
    contextVariable: ['feature'],  // enables jexl callbacks
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

The `baseTrackConfig.ts` `preProcessSnapshot` automatically promotes old
`renderer: { type: "CanvasFeatureRenderer", color1: "..." }` blocks to
display-level properties. Old configs work without migration.

## Key functions

| Function | Location | Purpose |
|----------|----------|---------|
| `getConfSnapshot(config)` | `packages/core/src/configuration/util.ts` | Snapshot with defaults included, JEXL strings preserved |
| `readConfigValue(config, key, feature)` | `plugins/canvas/src/RenderFeatureDataRPC/renderConfig.ts` | Read from plain object, auto-evaluate JEXL |
| `createRenderConfigContext(config)` | Same file | Extract frequently-accessed fields for the rendering loop |

## What this replaces

| Old pattern | New pattern |
|-------------|-------------|
| `readConfObject(mstModel, key, { feature })` in workers | `readConfigValue(plainObj, key, feature)` |
| `configSchema.create(snapshot, { pluginManager })` re-hydration | Not needed — plain objects work directly |
| `CachedConfig<T>` / `readCachedConfig()` indirection | Removed — `readConfigValue` is simple and direct |
| Hardcoded `mockConfig` with fallback defaults | `getConfSnapshot` includes real values |
| Nested `renderer: { type: "X", color1: "..." }` in config | Direct `color1: "..."` on display config |

## Current adoption

- **Canvas plugin** (`LinearFeatureDisplay`, `LinearBasicDisplay`,
  `LinearVariantDisplay`): fully adopted
- **Wiggle, alignments, multi-variant**: already have direct config slots,
  render on main thread — no RPC config issue
- **Arc, lollipop, chord, HiC, dotplot**: still use old `ServerSideRendererType`
  pipeline — adopt when migrating to GPU rendering
