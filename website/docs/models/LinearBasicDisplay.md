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

used by `FeatureTrack`, has simple settings like "show/hide feature labels",
etc.

extends

- [BaseLinearDisplay](../baselineardisplay)

### LinearBasicDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearBasicDisplay">
// code
type: types.literal('LinearBasicDisplay')
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

#### property: trackSubfeatureLabels

```js
// type signature
IMaybe<ISimpleType<string>>
// code
trackSubfeatureLabels: types.maybe(types.string)
```

#### property: trackGeneGlyphMode

```js
// type signature
IMaybe<ISimpleType<string>>
// code
trackGeneGlyphMode: types.maybe(types.string)
```

#### property: configuration

```js
// type signature
AnyConfigurationSchemaType
// code
configuration: ConfigurationReference(configSchema)
```

#### property: jexlFilters

```js
// type signature
IMaybe<IArrayType<ISimpleType<string>>>
// code
jexlFilters: types.maybe(types.array(types.string))
```

### LinearBasicDisplay - Getters

#### getter: activeFilters

```js
// type
any
```

#### getter: rendererTypeName

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

#### getter: subfeatureLabels

```js
// type
any
```

#### getter: geneGlyphMode

```js
// type
any
```

#### getter: rendererConfig

```js
// type
{ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>
```

#### getter: featureUnderMouse

Override featureUnderMouse to return the volatile feature which is fetched
asynchronously via CoreGetFeatureDetails

```js
// type
Feature
```

### LinearBasicDisplay - Methods

#### method: renderProps

```js
// type signature
renderProps: () => { config: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>; filters: SerializableFilterChain; sequenceAdapter: any; }
```

#### method: renderingProps

```js
// type signature
renderingProps: () => { onFeatureClick(_: unknown, featureId?: string): Promise<void>; onFeatureContextMenu(_: unknown, featureId?: string): Promise<void>; displayModel: { id: string; type: string; rpcDriverName: string; } & NonEmptyObject & { ...; } & IStateTreeNode<...>; }
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => MenuItem[]
```

### LinearBasicDisplay - Actions

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

#### action: setSubfeatureLabels

```js
// type signature
setSubfeatureLabels: (val: string) => void
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

#### action: setGeneGlyphMode

```js
// type signature
setGeneGlyphMode: (val: string) => void
```
