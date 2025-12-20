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

#### property: type

```js
// type signature
ISimpleType<"LinearSyntenyView">
// code
type: types.literal('LinearSyntenyView')
```

#### property: /

```js
// type signature
true
// code
drawCIGAR: true
```

#### property: /

```js
// type signature
false
// code
drawCIGARMatchesOnly: false
```

#### property: drawCurves

```js
// type signature
false
// code
drawCurves: false
```

#### property: drawLocationMarkers

```js
// type signature
false
// code
drawLocationMarkers: false
```

#### property: init

used for initializing the view from a session snapshot example:

```json
{
  "views": [
    { "loc": "chr1:1-100", "assembly": "hg38", "tracks": ["genes"] },
    { "loc": "chr1:1-100", "assembly": "mm39" }
  ],
  "tracks": ["hg38_vs_mm39_synteny"]
}
```

```js
// type signature
IType<LinearSyntenyViewInit, LinearSyntenyViewInit, LinearSyntenyViewInit>
// code
init: types.frozen<LinearSyntenyViewInit | undefined>()
```

### LinearSyntenyView - Getters

#### getter: hasSomethingToShow

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

#### method: headerMenuItems

includes a subset of view menu options because the full list is a little
overwhelming

```js
// type signature
headerMenuItems: () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | ... 4 more ... | { ...; })[]
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

#### action: setDrawCIGAR

```js
// type signature
setDrawCIGAR: (arg: boolean) => void
```

#### action: setDrawCIGARMatchesOnly

```js
// type signature
setDrawCIGARMatchesOnly: (arg: boolean) => void
```

#### action: setDrawLocationMarkers

```js
// type signature
setDrawLocationMarkers: (arg: boolean) => void
```

#### action: showAllRegions

```js
// type signature
showAllRegions: () => void
```

#### action: setInit

```js
// type signature
setInit: (init?: LinearSyntenyViewInit) => void
```

#### action: exportSvg

```js
// type signature
exportSvg: (opts: ExportSvgOptions) => Promise<void>
```
