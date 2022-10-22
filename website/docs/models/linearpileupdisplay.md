---
id: linearpileupdisplay
title: LinearPileupDisplay
toplevel: true
---

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
ITypeUnion<any, any, any>
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

### LinearPileupDisplay - Getters

#### getter: maxHeight

```js
// type
any
```

#### getter: rendererConfig

```js
// type
{ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>
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

#### getter: rendererTypeName

```js
// type
string
```

#### getter: DisplayBlurb

```js
// type
any
```

### LinearPileupDisplay - Methods

#### method: contextMenuItems

```js
// type signature
contextMenuItems: () => { label: string; icon: any; onClick: () => void; }[]
```

#### method: renderProps

```js
// type signature
renderProps: () => any
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => any[]
```

### LinearPileupDisplay - Actions

#### action: setReady

```js
// type signature
setReady: (flag: boolean) => void
```

#### action: setMaxHeight

```js
// type signature
setMaxHeight: (n: number) => void
```

#### action: setFeatureHeight

```js
// type signature
setFeatureHeight: (n: number) => void
```

#### action: setNoSpacing

```js
// type signature
setNoSpacing: (flag: boolean) => void
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
setConfig: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => void
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
