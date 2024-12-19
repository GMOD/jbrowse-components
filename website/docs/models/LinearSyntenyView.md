---
id: linearsyntenyview
title: LinearSyntenyView
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
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

#### property: drawCurves

```js
// type signature
false
// code
drawCurves: false
```

### LinearSyntenyView - Methods

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

#### action: toggleCurves

```js
// type signature
toggleCurves: () => void
```

#### action: toggleCIGAR

```js
// type signature
toggleCIGAR: () => void
```

#### action: showAllRegions

```js
// type signature
showAllRegions: () => void
```

#### action: exportSvg

```js
// type signature
exportSvg: (opts: ExportSvgOptions) => Promise<void>
```
