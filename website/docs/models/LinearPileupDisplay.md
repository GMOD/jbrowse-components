---
id: linearpileupdisplay
title: LinearPileupDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearPileupDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearPileupDisplay.md)

## Docs

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
any
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

#### getter: modificationThreshold

```js
// type
any
```

#### getter: rendererConfig

```js
// type
any
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

#### method: adapterRenderProps

```js
// type signature
adapterRenderProps: () => any
```

#### method: renderProps

```js
// type signature
renderProps: () => any
```

#### method: showSubMenuItems

```js
// type signature
showSubMenuItems: () => ({ label: string; type: "subMenu"; subMenu: { label: string; type: "radio"; checked: boolean; onClick: () => void; }[]; } | { label: string; type: string; checked: any; onClick: () => void; })[]
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => readonly [...MenuItem[], { readonly label: "Sort by..."; readonly icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; readonly disabled: boolean; readonly subMenu: readonly [......[]]; }, { ...; }, { ...; }]
```

### LinearPileupDisplay - Actions

#### action: setCurrSortBpPerPx

```js
// type signature
setCurrSortBpPerPx: (n: number) => void
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

#### action: setSortedByAtPosition

Sort by a specific position (used for sorting at mismatch positions)

```js
// type signature
setSortedByAtPosition: (type: string, pos: number, refName: string) => void
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
