---
id: sharedlinearpileupdisplaymixin
title: SharedLinearPileupDisplayMixin
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[plugins/alignments/src/LinearPileupDisplay/SharedLinearPileupDisplayMixin.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearPileupDisplay/SharedLinearPileupDisplayMixin.ts)

extends `BaseLinearDisplay`

### SharedLinearPileupDisplayMixin - Properties

#### property: configuration

```js
// type signature
AnyConfigurationSchemaType
// code
configuration: ConfigurationReference(configSchema)
```

#### property: featureHeight

```js
// type signature
IMaybe<ISimpleType<number>>
// code
featureHeight: types.maybe(types.number)
```

#### property: noSpacing

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
noSpacing: types.maybe(types.boolean)
```

#### property: fadeLikelihood

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
fadeLikelihood: types.maybe(types.boolean)
```

#### property: trackMaxHeight

```js
// type signature
IMaybe<ISimpleType<number>>
// code
trackMaxHeight: types.maybe(types.number)
```

#### property: colorBy

```js
// type signature
IType<ColorBy, ColorBy, ColorBy>
// code
colorBy: types.frozen<ColorBy | undefined>()
```

#### property: filterBy

```js
// type signature
IOptionalIType<IType<FilterBy, FilterBy, FilterBy>, [undefined]>
// code
filterBy: types.optional(types.frozen<FilterBy>(), defaultFilterFlags)
```

#### property: jexlFilters

```js
// type signature
IOptionalIType<IArrayType<ISimpleType<string>>, [undefined]>
// code
jexlFilters: types.optional(types.array(types.string), [])
```

### SharedLinearPileupDisplayMixin - Getters

#### getter: rendererConfig

```js
// type
{ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>
```

#### getter: maxHeight

```js
// type
any
```

#### getter: featureHeightSetting

```js
// type
any
```

#### getter: featureUnderMouse

```js
// type
Feature
```

#### getter: renderReady

```js
// type
;() => boolean
```

#### getter: filters

```js
// type
SerializableFilterChain
```

#### getter: rendererTypeName

```js
// type
string
```

#### getter: DisplayBlurb

```js
// type
({ model, }: { model: { sortedBy?: { pos: number; refName: number; type: string; tag?: string; }; }; }) => Element
```

### SharedLinearPileupDisplayMixin - Methods

#### method: contextMenuItems

```js
// type signature
contextMenuItems: () => { label: string; icon: (props: SvgIconProps) => Element; onClick: () => void; }[]
```

#### method: renderPropsPre

```js
// type signature
renderPropsPre: () => any
```

#### method: colorSchemeSubMenuItems

```js
// type signature
colorSchemeSubMenuItems: () => { label: string; onClick: () => void; }[]
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => MenuItem[]
```

### SharedLinearPileupDisplayMixin - Actions

#### action: setTagsReady

```js
// type signature
setTagsReady: (flag: boolean) => void
```

#### action: setMaxHeight

```js
// type signature
setMaxHeight: (n?: number) => void
```

#### action: setFeatureHeight

```js
// type signature
setFeatureHeight: (n?: number) => void
```

#### action: setNoSpacing

```js
// type signature
setNoSpacing: (flag?: boolean) => void
```

#### action: setColorScheme

```js
// type signature
setColorScheme: (colorScheme: ColorBy) => void
```

#### action: updateColorTagMap

```js
// type signature
updateColorTagMap: (uniqueTag: string[]) => void
```

#### action: setFeatureUnderMouse

```js
// type signature
setFeatureUnderMouse: (feat?: Feature) => void
```

#### action: selectFeature

```js
// type signature
selectFeature: (feature: Feature) => void
```

#### action: copyFeatureToClipboard

uses copy-to-clipboard and generates notification

```js
// type signature
copyFeatureToClipboard: (feature: Feature) => void
```

#### action: setConfig

```js
// type signature
setConfig: (conf: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>) => void
```

#### action: setFilterBy

```js
// type signature
setFilterBy: (filter: FilterBy) => void
```

#### action: setJexlFilters

```js
// type signature
setJexlFilters: (filters: string[]) => void
```
