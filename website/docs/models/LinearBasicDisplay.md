---
id: linearbasicdisplay
title: LinearBasicDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/LinearBasicDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearBasicDisplay.md)

## Docs

Used by `FeatureTrack`, has simple settings like "show/hide feature labels",
plus gene glyph display options.

extends

- [LinearFeatureDisplay](../linearfeaturedisplay)

### LinearBasicDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearBasicDisplay">
// code
type: types.literal('LinearBasicDisplay')
```

#### property: trackGeneGlyphMode

```js
// type signature
IMaybe<ISimpleType<string>>
// code
trackGeneGlyphMode: types.maybe(types.string)
```

#### property: trackSubfeatureLabels

```js
// type signature
IMaybe<ISimpleType<string>>
// code
trackSubfeatureLabels: types.maybe(types.string)
```

#### property: trackDisplayDirectionalChevrons

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
trackDisplayDirectionalChevrons: types.maybe(types.boolean)
```

#### property: configuration

```js
// type signature
any
// code
configuration: ConfigurationReference(configSchema)
```

### LinearBasicDisplay - Getters

#### getter: geneGlyphMode

```js
// type
any
```

#### getter: subfeatureLabels

```js
// type
any
```

#### getter: displayDirectionalChevrons

```js
// type
any
```

#### getter: rendererConfig

```js
// type
{
  showLabels: any
  showDescriptions: any
  subfeatureLabels: any
  displayMode: any
  maxHeight: any
  geneGlyphMode: any
  displayDirectionalChevrons: any
}
```

### LinearBasicDisplay - Methods

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => MenuItem[]
```

### LinearBasicDisplay - Actions

#### action: setGeneGlyphMode

```js
// type signature
setGeneGlyphMode: (val: string) => void
```

#### action: setSubfeatureLabels

```js
// type signature
setSubfeatureLabels: (val: string) => void
```

#### action: toggleDisplayDirectionalChevrons

```js
// type signature
toggleDisplayDirectionalChevrons: () => void
```
