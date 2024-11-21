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
IType<SortedBy, SortedBy, SortedBy>
// code
sortedBy: types.frozen<SortedBy | undefined>()
```

### LinearPileupDisplay - Getters

#### getter: visibleModificationTypes

```js
// type
any[]
```

#### getter: rendererConfig

```js
// type
{ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>
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
trackMenuItems: () => readonly [...MenuItem[], { readonly label: "Sort by..."; readonly icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; readonly disabled: boolean; readonly subMenu: readonly [......[]]; }, { ...; }, { ...; }, { ...; }, { ...; }]
```

### LinearPileupDisplay - Actions

#### action: setCurrSortBpPerPx

```js
// type signature
setCurrSortBpPerPx: (n: number) => void
```

#### action: updateVisibleModifications

```js
// type signature
updateVisibleModifications: (uniqueModifications: ModificationType[]) => void
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

#### action: setFeatureHeight

overrides base from SharedLinearPileupDisplay to make sortReady false since
changing feature height destroys the sort-induced layout

```js
// type signature
setFeatureHeight: (n?: number) => void
```

#### action: reload

```js
// type signature
reload: () => void
```
