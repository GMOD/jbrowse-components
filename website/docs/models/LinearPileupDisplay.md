---
id: linearpileupdisplay
title: LinearPileupDisplay
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[plugins/alignments/src/LinearPileupDisplay/model.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearPileupDisplay/model.ts)

extends

- [SharedLinearPileupDisplayMixin](../sharedlinearpileupdisplaymixin)

### LinearPileupDisplay - Properties

#### property: configuration

```js
// type signature
AnyConfigurationSchemaType
// code
configuration: ConfigurationReference(configSchema)
```

#### property: mismatchAlpha

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
mismatchAlpha: types.maybe(types.boolean)
```

#### property: showSoftClipping

```js
// type signature
false
// code
showSoftClipping: false
```

#### property: sortedBy

```js
// type signature
IMaybe<IModelType<{ assemblyName: ISimpleType<string>; pos: ISimpleType<number>; refName: ISimpleType<string>; tag: IMaybe<ISimpleType<string>>; type: ISimpleType<...>; }, {}, _NotCustomized, _NotCustomized>>
// code
sortedBy: types.maybe(
          types.model({
            assemblyName: types.string,
            pos: types.number,
            refName: types.string,
            tag: types.maybe(types.string),
            type: types.string,
          }),
        )
```

#### property: type

```js
// type signature
ISimpleType<"LinearPileupDisplay">
// code
type: types.literal('LinearPileupDisplay')
```

### LinearPileupDisplay - Getters

#### getter: rendererConfig

```js
// type
{ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>
```

#### getter: mismatchAlphaSetting

```js
// type
any
```

### LinearPileupDisplay - Methods

#### method: renderReady

```js
// type signature
renderReady: () => boolean
```

#### method: renderProps

```js
// type signature
renderProps: () => any
```

#### method: renderPropsPre

```js
// type signature
renderPropsPre: () => any
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; } | { ...; } | { ...; } | { ...; })[]
```

### LinearPileupDisplay - Actions

#### action: clearSelected

```js
// type signature
clearSelected: () => void
```

#### action: setCurrSortBpPerPx

```js
// type signature
setCurrSortBpPerPx: (n: number) => void
```

#### action: setFeatureHeight

overrides base from SharedLinearPileupDisplay to make sortReady false since
changing feature height destroys the sort-induced layout

```js
// type signature
setFeatureHeight: (n?: number) => void
```

#### action: setModificationsReady

```js
// type signature
setModificationsReady: (flag: boolean) => void
```

#### action: setSortReady

```js
// type signature
setSortReady: (flag: boolean) => void
```

#### action: setSortedBy

```js
// type signature
setSortedBy: (type: string, tag?: string) => void
```

#### action: toggleMismatchAlpha

```js
// type signature
toggleMismatchAlpha: () => void
```

#### action: toggleSoftClipping

```js
// type signature
toggleSoftClipping: () => void
```

#### action: updateModificationColorMap

```js
// type signature
updateModificationColorMap: (uniqueModifications: string[]) => void
```

#### action: reload

```js
// type signature
reload: () => void
```
