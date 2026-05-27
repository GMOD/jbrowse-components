---
id: linearsyntenyview
title: LinearSyntenyView
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LinearSyntenyView/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearSyntenyView.md)

## Docs

extends

- [LinearComparativeView](../linearcomparativeview)

### LinearSyntenyView - Properties

#### propertie: type

```js
// type signature
ISimpleType<"LinearSyntenyView">
// code
type: types.literal('LinearSyntenyView')
```

#### propertie: cigarMode

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
cigarMode: types.optional(
          types.enumeration(['off', 'matches', 'full']),
          'full',
        )
```

#### propertie: drawCurves

```js
// type signature
false
// code
drawCurves: false
```

#### propertie: drawLocationMarkers

```js
// type signature
false
// code
drawLocationMarkers: false
```

#### propertie: overdrawPx

pixels beyond the visible viewport edge that synteny lines are still drawn

```js
// type signature
number
// code
overdrawPx: DEFAULT_OVERDRAW_PX
```

#### propertie: alpha

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
alpha: types.optional(types.number, 0.2)
```

#### propertie: minAlignmentLength

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
minAlignmentLength: types.optional(types.number, 0)
```

#### propertie: colorBy

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
colorBy: types.optional(types.string, 'default')
```

#### propertie: opacityByIdentity

Fade alignment blocks by per-feature identity (lower identity = more
transparent). Orthogonal to colorBy — surfaces identity-dropoff zones without
consuming the color channel.

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
opacityByIdentity: types.optional(types.boolean, false)
```

#### propertie: init

used for initializing the view from a session snapshot. tracks is 2D — outer
index is the level (the gap between views[i] and views[i+1]), so a 3-way view
has two entries. example:

```json
{
  "views": [
    { "loc": "chr1:1-100", "assembly": "hg38", "tracks": ["genes"] },
    { "loc": "chr1:1-100", "assembly": "mm39" },
    { "loc": "chr1:1-100", "assembly": "rn7" }
  ],
  "tracks": [["hg38_vs_mm39_synteny"], ["mm39_vs_rn7_synteny"]]
}
```

```js
// type signature
IType<LinearSyntenyViewInit | undefined, LinearSyntenyViewInit | undefined, LinearSyntenyViewInit | undefined>
// code
init: types.frozen<LinearSyntenyViewInit | undefined>()
```

### LinearSyntenyView - Getters

#### getter: effectiveAlpha

```js
// type
number
```

#### getter: hasSomethingToShow

```js
// type
boolean
```

#### getter: drawCIGAR

```js
// type
boolean
```

#### getter: drawCIGARMatchesOnly

```js
// type
boolean
```

#### getter: showLoading

Whether to show a loading indicator instead of the import form or view

```js
// type
boolean
```

#### getter: showImportForm

Whether to show the import form

```js
// type
boolean
```

### LinearSyntenyView - Methods

#### method: showMenuItems

```js
// type signature
showMenuItems: () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; })[]
```

#### method: headerMenuItems

includes a subset of view menu options because the full list is a little
overwhelming

```js
// type signature
headerMenuItems: () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; } | { ...; } | { ...; } | { ...; })[]
```

#### method: menuItems

```js
// type signature
menuItems: () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; })[]
```

### LinearSyntenyView - Actions

#### action: importFormRemoveRow

```js
// type signature
importFormRemoveRow: (idx: number) => void
```

#### action: clearImportFormSyntenyTracks

```js
// type signature
clearImportFormSyntenyTracks: () => void
```

#### action: setImportFormSyntenyTrack

```js
// type signature
setImportFormSyntenyTrack: (arg: number, val: ImportFormSyntenyTrack) => void
```

#### action: setDrawCurves

```js
// type signature
setDrawCurves: (arg: boolean) => void
```

#### action: setCigarMode

```js
// type signature
setCigarMode: (arg: "off" | "matches" | "full") => void
```

#### action: setDrawLocationMarkers

```js
// type signature
setDrawLocationMarkers: (arg: boolean) => void
```

#### action: setOverdrawPx

```js
// type signature
setOverdrawPx: (arg: number) => void
```

#### action: setAlpha

```js
// type signature
setAlpha: (arg: number) => void
```

#### action: setMinAlignmentLength

```js
// type signature
setMinAlignmentLength: (arg: number) => void
```

#### action: setColorBy

```js
// type signature
setColorBy: (arg: SyntenyColorBy) => void
```

#### action: setOpacityByIdentity

```js
// type signature
setOpacityByIdentity: (arg: boolean) => void
```

#### action: showAllRegions

```js
// type signature
showAllRegions: () => void
```

#### action: setInit

```js
// type signature
setInit: (init?: LinearSyntenyViewInit | undefined) => void
```

#### action: exportSvg

```js
// type signature
exportSvg: (opts: ExportSvgOptions) => Promise<void>
```
