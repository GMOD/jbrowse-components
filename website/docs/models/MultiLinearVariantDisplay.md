---
id: multilinearvariantdisplay
title: MultiLinearVariantDisplay
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/MultiLinearVariantDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/MultiLinearVariantDisplay.md)

## Docs

extends

- [LinearBareDisplay](../linearbaredisplay)

### MultiLinearVariantDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"MultiLinearVariantDisplay">
// code
type: types.literal('MultiLinearVariantDisplay')
```

#### property: layout

```js
// type signature
IOptionalIType<IType<Source[], Source[], Source[]>, [undefined]>
// code
layout: types.optional(types.frozen<Source[]>(), [])
```

#### property: rowHeightSetting

used only if autoHeight is false

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
rowHeightSetting: types.optional(types.number, 11)
```

#### property: autoHeight

adjust to height of track/display

```js
// type signature
false
// code
autoHeight: false
```

#### property: showSidebarLabelsSetting

```js
// type signature
true
// code
showSidebarLabelsSetting: true
```

### MultiLinearVariantDisplay - Getters

#### getter: featureUnderMouse

```js
// type
Feature
```

#### getter: TooltipComponent

```js
// type
React.ComponentType<any>
```

#### getter: sources

```js
// type
{ [x: string]: unknown; baseUri?: string; name: string; label?: string; color?: string; group?: string; HP?: number; }[]
```

#### getter: rowHeight

```js
// type
number
```

#### getter: canDisplayLabels

```js
// type
boolean
```

#### getter: totalHeight

```js
// type
number
```

### MultiLinearVariantDisplay - Methods

#### method: adapterProps

```js
// type signature
adapterProps: () => any
```

#### method: renderProps

```js
// type signature
renderProps: () => any
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; })[]
```

### MultiLinearVariantDisplay - Actions

#### action: setSourcesLoading

```js
// type signature
setSourcesLoading: (str: string) => void
```

#### action: setLayout

```js
// type signature
setLayout: (layout: Source[]) => void
```

#### action: clearLayout

```js
// type signature
clearLayout: () => void
```

#### action: setSources

```js
// type signature
setSources: (sources: Source[]) => void
```

#### action: setFeatureUnderMouse

```js
// type signature
setFeatureUnderMouse: (f?: Feature) => void
```

#### action: setRowHeight

```js
// type signature
setRowHeight: (arg: number) => void
```

#### action: setAutoHeight

```js
// type signature
setAutoHeight: (arg: boolean) => void
```

#### action: setShowSidebarLabels

```js
// type signature
setShowSidebarLabels: (arg: boolean) => void
```

#### action: renderSvg

```js
// type signature
renderSvg: (opts: ExportSvgDisplayOptions) => Promise<Element>
```
