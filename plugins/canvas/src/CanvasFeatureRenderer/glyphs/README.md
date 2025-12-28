# Creating Custom Glyphs for CanvasFeatureRenderer

This document describes how to create custom glyphs for rendering features in
the CanvasFeatureRenderer.

## Overview

Glyphs are responsible for two things:

1. **Layout** - Compute the rectangle a feature occupies (position and size)
2. **Draw** - Render the feature within that rectangle

Rendering happens in two phases:

1. Layout phase computes positions in **local coordinates** (relative to parent)
2. Draw phase receives positions converted to **canvas coordinates** (absolute
   pixels)

## The Glyph Interface

```typescript
interface Glyph {
  // Required
  type: GlyphType
  match(feature: Feature, configContext: RenderConfigContext): boolean
  layout(args: LayoutArgs): FeatureLayout
  draw(
    ctx: CanvasRenderingContext2D,
    layout: FeatureLayout,
    drawContext: DrawContext,
  ): void

  // Optional - for glyphs with clickable/hoverable children
  hasIndexableChildren?: boolean
  getSubfeatureMouseover?(feature: Feature): string | undefined
}
```

## Required Properties

### `type: GlyphType`

A string identifier for the glyph. Add new types to the `GlyphType` union in
`types.ts`:

```typescript
export type GlyphType = 'Box' | 'CDS' | 'YourNewGlyph' // Add here
```

### `match(feature, configContext): boolean`

Determines if this glyph should handle a given feature. Glyphs are checked in
priority order (see `builtinGlyphs` array in `index.ts`), and the first match
wins.

```typescript
match(feature, configContext) {
  const type = feature.get('type')
  // Match specific feature types
  return type === 'your_feature_type'
}
```

The `configContext` provides access to configuration like `transcriptTypes`,
`containerTypes`, etc.

### `layout(args: LayoutArgs): FeatureLayout`

Computes the layout rectangle for the feature. Returns positions in **local
coordinates** (relative to parent, starting at 0,0).

```typescript
interface LayoutArgs {
  feature: Feature // The feature to layout
  bpPerPx: number // Scale factor (base pairs per pixel)
  reversed: boolean // Whether view is reversed
  configContext: RenderConfigContext
  parentFeature?: Feature // Parent feature if nested
}
```

Returns a `FeatureLayout`:

```typescript
interface FeatureLayout {
  feature: Feature
  glyphType: GlyphType

  // Position in local coordinates (relative to parent, starts at 0,0)
  x: number
  y: number

  // Feature's own dimensions (the genomic extent converted to pixels)
  // - width: (end - start) / bpPerPx
  // - height: the box height used for drawing
  width: number
  height: number

  // Bounding box dimensions (includes decorations like strand arrows and labels)
  // Used for: hit detection, row allocation, stacking calculations
  //
  // ┌─────────────────────────────────────────────────┐
  // │←leftPadding→┌─────────────────┐←rightPadding→   │
  // │   (arrow)   │     feature     │   (arrow)       │
  // │             │  width×height   │                 │
  // │             └─────────────────┘                 │
  // │             │   label text    │ ← extra height  │
  // └─────────────────────────────────────────────────┘
  // ├──────────── totalLayoutWidth ──────────────────┤
  //
  // totalLayoutHeight:  height + label height (when labels are below the feature)
  // totalLayoutWidth:   width + leftPadding + rightPadding (or label width if wider)
  // leftPadding:        pixels reserved on the left (e.g., for left-pointing arrow)
  totalLayoutHeight: number
  totalLayoutWidth: number
  leftPadding: number

  children: FeatureLayout[]
}
```

**When are these different?**

- For simple boxes: all dimensions are equal (`width = totalLayoutWidth`,
  `height = totalLayoutHeight`)
- With strand arrows: `totalLayoutWidth = width + leftPadding + rightPadding`
- With labels below: `totalLayoutHeight = height + labelHeight`

Example layout function:

```typescript
layout(args: LayoutArgs): FeatureLayout {
  const { feature, bpPerPx, configContext } = args
  const { config, displayMode, featureHeight } = configContext

  const start = feature.get('start') as number
  const end = feature.get('end') as number
  const heightPx = readCachedConfig(featureHeight, config, 'height', feature)
  const baseHeight = displayMode === 'compact' ? heightPx / 2 : heightPx
  const widthPx = (end - start) / bpPerPx

  return {
    feature,
    glyphType: 'YourNewGlyph',
    x: 0,  // Local coordinates start at 0
    y: 0,
    width: widthPx,
    height: baseHeight,
    totalLayoutHeight: baseHeight,
    totalLayoutWidth: widthPx,
    leftPadding: 0,
    children: [],
  }
}
```

### `draw(ctx, layout, drawContext): void`

Renders the feature to the canvas. The `layout` positions are already converted
to **canvas coordinates**.

```typescript
interface DrawContext {
  region: Region
  bpPerPx: number
  configContext: RenderConfigContext
  theme: Theme // MUI theme with colors
  canvasWidth: number
  peptideDataMap?: Map<string, PeptideData>
  colorByCDS?: boolean
}
```

Example draw function:

```typescript
draw(ctx: CanvasRenderingContext2D, layout: FeatureLayout, dc: DrawContext) {
  const { x: left, y: top, width, height } = layout
  const { theme, canvasWidth } = dc

  // Skip if off-screen
  if (left + width < 0 || left > canvasWidth) {
    return
  }

  // Draw the feature
  ctx.fillStyle = theme.palette.primary.main
  ctx.fillRect(left, top, width, height)
}
```

## Optional Properties

### `hasIndexableChildren?: boolean`

Set to `true` if this glyph's children should be indexed for hit detection
(mouseover, click). When true, children will be added to the spatial index and
can have floating labels.

### `getSubfeatureMouseover?(feature: Feature): string | undefined`

Provides custom mouseover text for child features. If not provided, falls back
to the `subfeatureMouseover` config callback.

```typescript
getSubfeatureMouseover(feature: Feature) {
  const name = feature.get('name')
  const id = feature.get('id')
  return name ? `${name} (${id})` : undefined
}
```

## Laying Out Children

If your glyph has children, layout them with proper positions:

```typescript
layout(args: LayoutArgs): FeatureLayout {
  const { feature, bpPerPx, reversed, configContext } = args

  // ... compute parent dimensions ...

  const subfeatures = feature.get('subfeatures') || []
  const children: FeatureLayout[] = []

  for (let i = 0; i < subfeatures.length; i++) {
    const child = subfeatures[i]
    const childStart = child.get('start')
    const childEnd = child.get('end')
    const parentStart = feature.get('start')
    const parentEnd = feature.get('end')

    // Compute child position relative to parent
    const offsetBp = reversed
      ? parentEnd - childEnd
      : childStart - parentStart
    const xRelative = offsetBp / bpPerPx
    const yRelative = i * rowHeight  // Stack vertically

    children.push({
      feature: child,
      glyphType: 'Box',
      x: xRelative,
      y: yRelative,
      width: (childEnd - childStart) / bpPerPx,
      height: rowHeight,
      totalLayoutHeight: rowHeight,
      totalLayoutWidth: (childEnd - childStart) / bpPerPx,
      leftPadding: 0,
      children: [],
    })
  }

  return {
    // ... parent layout ...
    children,
  }
}
```

## Registering Your Glyph

1. Add to `GlyphType` union in `types.ts`
2. Export from your glyph file
3. Add to `builtinGlyphs` array in `index.ts` (order matters - more specific
   first)
4. Add to `glyphMap` in `drawFeature.ts`

```typescript
// index.ts
export const builtinGlyphs: Glyph[] = [
  yourNewGlyph, // Add before less-specific glyphs
  // ...
  boxGlyph, // Fallback last
]

// drawFeature.ts
const glyphMap: Record<string, Glyph> = {
  YourNewGlyph: yourNewGlyph,
  // ...
}
```

## Example: Simple Colored Box Glyph

```typescript
import { readCachedConfig } from '../renderConfig'
import { isOffScreen } from '../util'
import type { DrawContext, FeatureLayout, Glyph, LayoutArgs } from '../types'

export const coloredBoxGlyph: Glyph = {
  type: 'ColoredBox',

  match(feature) {
    return feature.get('type') === 'colored_region'
  },

  layout(args: LayoutArgs): FeatureLayout {
    const { feature, bpPerPx, configContext } = args
    const { config, displayMode, featureHeight } = configContext

    const start = feature.get('start') as number
    const end = feature.get('end') as number
    const heightPx = readCachedConfig(featureHeight, config, 'height', feature)
    const baseHeight = displayMode === 'compact' ? heightPx / 2 : heightPx
    const widthPx = (end - start) / bpPerPx

    return {
      feature,
      glyphType: 'ColoredBox',
      x: 0,
      y: 0,
      width: widthPx,
      height: baseHeight,
      totalLayoutHeight: baseHeight,
      totalLayoutWidth: widthPx,
      leftPadding: 0,
      children: [],
    }
  },

  draw(ctx: CanvasRenderingContext2D, layout: FeatureLayout, dc: DrawContext) {
    const { feature } = layout
    const { canvasWidth } = dc

    const left = layout.x
    const top = layout.y
    const width = layout.width
    const height = layout.height

    if (isOffScreen(left, width, canvasWidth)) {
      return
    }

    // Use feature's color attribute or default
    const color = feature.get('color') || '#999'

    ctx.fillStyle = color
    ctx.fillRect(left, top, width, height)

    ctx.strokeStyle = 'rgba(0,0,0,0.3)'
    ctx.lineWidth = 1
    ctx.strokeRect(left, top, width, height)
  },
}
```

## Tips

- Use `readCachedConfig()` for reading config values (caches results)
- Use `isOffScreen()` to skip drawing features outside the visible area
- Access theme colors via `dc.theme.palette`
- For strand arrows, see `segments.ts` or `processed.ts` for examples
- Children positions are relative to parent - the system converts to canvas
  coordinates automatically
