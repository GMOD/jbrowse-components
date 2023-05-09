---
id: linearpileupdisplay
title: LinearPileupDisplay
toplevel: true
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

## Source file

[plugins/alignments/src/LinearPileupDisplay/model.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearPileupDisplay/model.ts)

## Docs

extends `BaseLinearDisplay`

### LinearPileupDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearPileupDisplay">
// code
type: types.literal('LinearPileupDisplay')
```

#### property: configuration

```js
// type signature
AnyConfigurationSchemaType
// code
configuration: ConfigurationReference(configSchema)
```

#### property: showSoftClipping

```js
// type signature
false
// code
showSoftClipping: false
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

#### property: mismatchAlpha

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
mismatchAlpha: types.maybe(types.boolean)
```

#### property: sortedBy

```js
// type signature
IMaybe<IModelType<{ type: ISimpleType<string>; pos: ISimpleType<number>; tag: IMaybe<ISimpleType<string>>; refName: ISimpleType<string>; assemblyName: ISimpleType<...>; }, {}, _NotCustomized, _NotCustomized>>
// code
sortedBy: types.maybe(
          types.model({
            type: types.string,
            pos: types.number,
            tag: types.maybe(types.string),
            refName: types.string,
            assemblyName: types.string,
          }),
        )
```

#### property: colorBy

```js
// type signature
IMaybe<IModelType<{ type: ISimpleType<string>; tag: IMaybe<ISimpleType<string>>; extra: IType<any, any, any>; }, {}, _NotCustomized, _NotCustomized>>
// code
colorBy: types.maybe(
          types.model({
            type: types.string,
            tag: types.maybe(types.string),
            extra: types.frozen(),
          }),
        )
```

#### property: filterBy

```js
// type signature
IOptionalIType<IModelType<{ flagInclude: IOptionalIType<ISimpleType<number>, [undefined]>; flagExclude: IOptionalIType<ISimpleType<number>, [undefined]>; readName: IMaybe<...>; tagFilter: IMaybe<...>; }, {}, _NotCustomized, _NotCustomized>, [...]>
// code
filterBy: types.optional(FilterModel, {})
```

### LinearPileupDisplay - Getters

#### getter: rendererConfig

```js
// type
{ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>
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

#### getter: mismatchAlphaSetting

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
boolean
```

#### getter: rendererTypeName

```js
// type
string
```

#### getter: DisplayBlurb

```js
// type
;(props: LinearPileupDisplayBlurbProps) => Element
```

### LinearPileupDisplay - Methods

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

#### method: renderProps

```js
// type signature
renderProps: () => any
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; } | { ...; } | { ...; })[]
```

### LinearPileupDisplay - Actions

#### action: setModificationsReady

```js
// type signature
setModificationsReady: (flag: boolean) => void
```

#### action: setTagsReady

```js
// type signature
setTagsReady: (flag: boolean) => void
```

#### action: setSortReady

```js
// type signature
setSortReady: (flag: boolean) => void
```

#### action: setCurrSortBpPerPx

```js
// type signature
setCurrSortBpPerPx: (n: number) => void
```

#### action: setMaxHeight

```js
// type signature
setMaxHeight: (n: number) => void
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
setColorScheme: (colorScheme: { type: string; tag?: string; }) => void
```

#### action: updateModificationColorMap

```js
// type signature
updateModificationColorMap: (uniqueModifications: string[]) => void
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

#### action: clearSelected

```js
// type signature
clearSelected: () => void
```

#### action: copyFeatureToClipboard

uses copy-to-clipboard and generates notification

```js
// type signature
copyFeatureToClipboard: (feature: Feature) => void
```

#### action: toggleSoftClipping

```js
// type signature
toggleSoftClipping: () => void
```

#### action: toggleMismatchAlpha

```js
// type signature
toggleMismatchAlpha: () => void
```

#### action: setConfig

```js
// type signature
setConfig: (conf: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => void
```

#### action: setSortedBy

```js
// type signature
setSortedBy: (type: string, tag?: string) => void
```

#### action: reload

```js
// type signature
reload: () => void
```
