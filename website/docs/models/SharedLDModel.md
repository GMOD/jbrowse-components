---
id: sharedldmodel
title: SharedLDModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LDDisplay/shared.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/SharedLDModel.md)

## Docs

Shared state model for LD displays extends

- [BaseDisplay](../basedisplay)
- [TrackHeightMixin](../trackheightmixin)
- [GlobalDataDisplayMixin](../globaldatadisplaymixin)
- [StaleViewportRescaleMixin](../staleviewportrescalemixin)
- [ConfigOverrideMixin](../configoverridemixin)

### SharedLDModel - Getters

#### getter: prefersOffset

```js
// type
boolean
```

#### getter: snps

Returns true if this display uses pre-computed LD data (PLINK, ldmat) rather
than computing LD from VCF genotypes

```js
// type
LDSnp[]
```

#### getter: ldCanvasHeight

Effective height for the LD canvas (total height minus line zone) Note:
Recombination track is overlaid on the line zone, not in a separate zone

```js
// type
number
```

#### getter: renderTransform

Per-frame render state for the GPU backend. Read by the upload/render autorun —
every change to any tracked observable (view.bpPerPx, view.offsetPx,
model.fitToHeight, rpcData contents, …) re-fires it. Forward transform { scale,
viewOffsetX } shared by GPU render, mouse hit-test, and the
matrix→genomic-position SVG lines. See `computeRenderTransform` for the math.

```js
// type
RenderTransform
```

#### getter: effectiveLineZoneHeight

Pixel height of the SVG zone above the canvas (variant labels + lines, or
recombination scale). The hit-test subtracts this from mouseY before reversing
the render transform.

```js
// type
number
```

### SharedLDModel - Methods

#### method: hitTest

Inverse of `renderTransform` for the LD matrix: takes mouse coords
(canvas-relative) and returns the LD cell under the cursor, or undefined.
Mirrors plugins/hic's `hitTest` so both contact maps keep the forward and
inverse transforms paired on the model.

```js
// type signature
hitTest: (mouseX: number, mouseY: number) => LDFlatbushItem | undefined
```

#### method: filterMenuItems

```js
// type signature
filterMenuItems: () => { label: string; onClick: () => void; }[]
```

#### method: legendItems

```js
// type signature
legendItems: () => LegendItem[]
```

#### method: svgLegendWidth

```js
// type signature
svgLegendWidth: () => number
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; } | { ...; })[]
```

#### method: renderSvg

```js
// type signature
renderSvg: (opts: ExportSvgDisplayOptions) => Promise<ReactNode>
```

### SharedLDModel - Actions

#### action: startBackend

Starts the upload/render autorun. Data + color ramp both derive from the same
rpcData object, so a single identity-diffed slot handles both uploads.

```js
// type signature
startBackend: (backend: LDBackend) => void
```

#### action: performLDFetch

Re-fetches LD matrix for the current viewport. Both the autorun (in
`afterAttach`) and `reload()` invoke this directly.

```js
// type signature
performLDFetch: () => Promise<void>
```

#### action: reload

```js
// type signature
reload: () => void
```
