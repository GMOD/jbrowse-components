---
id: sharedlinearpileupdisplaymixin
title: SharedLinearPileupDisplayMixin
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearPileupDisplay/SharedLinearPileupDisplayMixin.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/SharedLinearPileupDisplayMixin.md)

## Docs

extends

- [BaseLinearDisplay](../baselineardisplay)

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

#### property: colorBySetting

```js
// type signature
IType<ColorBy, ColorBy, ColorBy>
// code
colorBySetting: types.frozen<ColorBy | undefined>()
```

#### property: filterBySetting

```js
// type signature
IType<FilterBy, FilterBy, FilterBy>
// code
filterBySetting: types.frozen<FilterBy | undefined>()
```

#### property: jexlFilters

```js
// type signature
IOptionalIType<IArrayType<ISimpleType<string>>, [undefined]>
// code
jexlFilters: types.optional(types.array(types.string), [])
```

#### property: hideSmallIndelsSetting

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
hideSmallIndelsSetting: types.maybe(types.boolean)
```

### SharedLinearPileupDisplayMixin - Getters

#### getter: colorBy

```js
// type
any
```

#### getter: filterBy

```js
// type
any
```

#### getter: autorunReady

```js
// type
boolean
```

#### getter: hideSmallIndels

```js
// type
boolean
```

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
({ model, }: { model: { sortedBy?: SortedBy; }; }) => Element
```

### SharedLinearPileupDisplayMixin - Methods

#### method: copyFeatureToClipboard

uses copy-to-clipboard and generates notification

```js
// type signature
copyFeatureToClipboard: (feature: Feature) => void
```

#### method: contextMenuItems

```js
// type signature
contextMenuItems: () => { label: string; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; onClick: () => void; }[]
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
trackMenuItems: () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; } | { ...; })[]
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

#### action: setHideSmallIndels

```js
// type signature
setHideSmallIndels: (arg: boolean) => void
```
