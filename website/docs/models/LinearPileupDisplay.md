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
trackMenuItems: () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; } | { ...; } | { ...; } | { ...; })[]
```

### LinearPileupDisplay - Actions

#### action: setCurrSortBpPerPx

```js
// type signature
setCurrSortBpPerPx: (n: number) => void
```

#### action: updateModificationColorMap

```js
// type signature
updateModificationColorMap: (uniqueModifications: string[]) => void
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

#### action: clearSelected

```js
// type signature
clearSelected: () => void
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
