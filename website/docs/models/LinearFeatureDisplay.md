---
id: linearfeaturedisplay
title: LinearFeatureDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/LinearFeatureDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearFeatureDisplay.md)

## Docs

Base model for feature displays. Provides labels, descriptions, display modes,
filters, etc. Does not include gene glyph functionality.

extends

- [BaseLinearDisplay](../baselineardisplay)

### LinearFeatureDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearFeatureDisplay">
// code
type: types.literal('LinearFeatureDisplay')
```

#### property: trackShowLabels

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
trackShowLabels: types.maybe(types.boolean)
```

#### property: trackShowDescriptions

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
trackShowDescriptions: types.maybe(types.boolean)
```

#### property: trackDisplayMode

```js
// type signature
IMaybe<ISimpleType<string>>
// code
trackDisplayMode: types.maybe(types.string)
```

#### property: trackMaxHeight

```js
// type signature
IMaybe<ISimpleType<number>>
// code
trackMaxHeight: types.maybe(types.number)
```

#### property: configuration

```js
// type signature
any
// code
configuration: ConfigurationReference(configSchema)
```

#### property: jexlFiltersSetting

```js
// type signature
IMaybe<IArrayType<ISimpleType<string>>>
// code
jexlFiltersSetting: types.maybe(types.array(types.string))
```

### LinearFeatureDisplay - Getters

#### getter: rendererTypeName

```js
// type
any
```

#### getter: sequenceAdapter

```js
// type
any
```

#### getter: showLabels

```js
// type
any
```

#### getter: showDescriptions

```js
// type
any
```

#### getter: maxHeight

```js
// type
any
```

#### getter: displayMode

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
  displayMode: any
  maxHeight: any
}
```

#### getter: featureUnderMouse

Override featureUnderMouse to return the volatile feature which is fetched
asynchronously via CoreGetFeatureDetails

```js
// type
any
```

### LinearFeatureDisplay - Methods

#### method: activeFilters

```js
// type signature
activeFilters: () => string[]
```

#### method: renderProps

```js
// type signature
renderProps: () => {
  config: {
    showLabels: any
    showDescriptions: any
    displayMode: any
    maxHeight: any
  }
  filters: any
  sequenceAdapter: any
}
```

#### method: renderingProps

```js
// type signature
renderingProps: () => { onFeatureClick(_: unknown, featureId?: string): Promise<void>; onFeatureContextMenu(_: unknown, featureId?: string): Promise<void>; displayModel: { [x: string]: any; ... 6 more ...; showTooltips: boolean; } & ... 17 more ... & IStateTreeNode<...>; onMouseMove(_: unknown, featureId?: string): void; onMouseLea...
```

#### method: filterMenuItems

```js
// type signature
filterMenuItems: () => MenuItem[]
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => MenuItem[]
```

### LinearFeatureDisplay - Actions

#### action: setJexlFilters

```js
// type signature
setJexlFilters: (f?: string[]) => void
```

#### action: setFeatureUnderMouse

```js
// type signature
setFeatureUnderMouse: (feat?: Feature) => void
```

#### action: toggleShowLabels

```js
// type signature
toggleShowLabels: () => void
```

#### action: toggleShowDescriptions

```js
// type signature
toggleShowDescriptions: () => void
```

#### action: setDisplayMode

```js
// type signature
setDisplayMode: (val: string) => void
```

#### action: setMaxHeight

```js
// type signature
setMaxHeight: (val?: number) => void
```
