---
id: linearreferencesequencedisplay
title: LinearReferenceSequenceDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/LinearReferenceSequenceDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearReferenceSequenceDisplay.md)

## Example usage

A complete `ReferenceSequenceTrack` config to paste into `tracks` (an assembly's
`sequence` track takes the same shape). `showForward`, `showReverse`, and
`showTranslation` toggle the strand/translation rows:

```js
{
  type: 'ReferenceSequenceTrack',
  trackId: 'refseq',
  name: 'Reference sequence',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'IndexedFastaAdapter',
    uri: 'https://example.com/genome.fa',
  },
  displays: [
    {
      type: 'LinearReferenceSequenceDisplay',
      displayId: 'refseq-LinearReferenceSequenceDisplay',
      showTranslation: false,
    },
  ],
}
```

## Overview

base model `BaseDisplay` + `TrackHeightMixin` + `MultiRegionDisplayMixin`

### LinearReferenceSequenceDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearReferenceSequenceDisplay">
// code
type: types.literal('LinearReferenceSequenceDisplay')
```

#### property: configuration

```js
// type signature
ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

#### property: showForward

```js
// type signature
true
// code
showForward: true
```

#### property: showReverse

```js
// type signature
true
// code
showReverse: true
```

#### property: showTranslation

```js
// type signature
true
// code
showTranslation: true
```

### LinearReferenceSequenceDisplay - Volatiles

#### volatile: colorState

theme-derived colors, pushed from the component (theme lives in React/MUI).
Feeds `renderState`; until set, `renderState` is undefined and the render
autorun skips — same pattern as wiggle/MAF.

```js
// type signature
{ palette: ColorPalette; textColors: TextColors; } | undefined
// code
colorState: undefined as
        | { palette: ColorPalette; textColors: TextColors }
        | undefined
```

### LinearReferenceSequenceDisplay - Getters

#### getter: sequenceType

```js
// type
any
```

#### getter: isDna

true for DNA tracks; reverse-complement and translation rows are gated on this
since they are biologically meaningful only for DNA.

```js
// type
boolean
```

#### getter: effectiveShowReverse

reverse-complement row is meaningful only for DNA

```js
// type
boolean
```

#### getter: effectiveShowTranslation

translation rows are meaningful only for DNA

```js
// type
boolean
```

#### getter: zoomedOut

the view is too zoomed out to show individual bases

```js
// type
boolean
```

#### getter: computedHeight

collapses to 50px when zoomed out (no sequence visible) or before the view
initializes; otherwise sized to fit the visible rows.

```js
// type
number
```

#### getter: height

override TrackHeightMixin height: use manual resize if set, otherwise the
zoom-aware computed height.

```js
// type
number
```

#### getter: renderState

everything the Canvas2D backend needs to paint a frame, or undefined until the
theme-derived colors arrive (render autorun skips on undefined).

```js
// type
DrawSequenceState | undefined
```

#### getter: loadingOverlayVisible

Same policy as MultiRegionDisplayMixin plus a zoom gate: when zoomed past base
resolution the body shows a "zoom in" message, so the loading scrim must stay
hidden over it.

```js
// type
boolean
```

### LinearReferenceSequenceDisplay - Methods

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => { label: string; type: string; checked: boolean; onClick: () => void; }[]
```

### LinearReferenceSequenceDisplay - Actions

#### action: setColorState

push theme-derived colors in from the component

```js
// type signature
setColorState: (palette: ColorPalette, textColors: TextColors) => void
```

#### action: toggleShowForward

```js
// type signature
toggleShowForward: () => void
```

#### action: toggleShowReverse

```js
// type signature
toggleShowReverse: () => void
```

#### action: toggleShowTranslation

```js
// type signature
toggleShowTranslation: () => void
```

#### action: startRenderingBackend

Called by `useRenderingBackend` (via DisplayChrome) once the canvas backend is
created. Streams each fetched region into the backend and draws every frame from
`renderState`.

```js
// type signature
startRenderingBackend: (backend: Canvas2DSequenceRenderer) => void
```
