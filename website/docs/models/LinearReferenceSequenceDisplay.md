---
id: linearreferencesequencedisplay
title: LinearReferenceSequenceDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/LinearReferenceSequenceDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearReferenceSequenceDisplay.md)

## Docs

base model `BaseDisplay` + `TrackHeightMixin` + `MultiRegionDisplayMixin`

### LinearReferenceSequenceDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearReferenceSequenceDisplay">
// code
type: types.literal('LinearReferenceSequenceDisplay')
```

#### property: configuration

```js
// type signature
ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

#### property: showForward

```js
// type signature
true
// code
showForward: true
```

#### property: showReverse

```js
// type signature
true
// code
showReverse: true
```

#### property: showTranslation

```js
// type signature
true
// code
showTranslation: true
```

### LinearReferenceSequenceDisplay - Getters

#### getter: sequenceType

```js
// type
any
```

#### getter: isDna

true for DNA tracks; reverse-complement and translation rows are gated on this
since they are biologically meaningful only for DNA.

```js
// type
boolean
```

#### getter: zoomedOut

the view is too zoomed out to show individual bases

```js
// type
boolean
```

#### getter: computedHeight

collapses to 50px when zoomed out (no sequence visible) or before the view
initializes; otherwise sized to fit the visible rows.

```js
// type
number
```

#### getter: height

override TrackHeightMixin height: use manual resize if set, otherwise the
zoom-aware computed height.

```js
// type
number
```

### LinearReferenceSequenceDisplay - Methods

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => { label: string; type: string; checked: boolean; onClick: () => void; }[]
```

### LinearReferenceSequenceDisplay - Actions

#### action: toggleShowForward

```js
// type signature
toggleShowForward: () => void
```

#### action: toggleShowReverse

```js
// type signature
toggleShowReverse: () => void
```

#### action: toggleShowTranslation

```js
// type signature
toggleShowTranslation: () => void
```
