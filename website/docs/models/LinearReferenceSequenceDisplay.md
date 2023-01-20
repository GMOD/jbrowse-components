---
id: linearreferencesequencedisplay
title: LinearReferenceSequenceDisplay
toplevel: true
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

## Source file

[plugins/sequence/src/LinearReferenceSequenceDisplay/model.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/LinearReferenceSequenceDisplay/model.ts)

## Docs

base model `BaseLinearDisplay`

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

#### getter: rendererTypeName

```js
// type
any
```

### LinearReferenceSequenceDisplay - Methods

#### method: renderProps

```js
// type signature
renderProps: () => any
```

#### method: regionCannotBeRendered

```js
// type signature
regionCannotBeRendered: () => 'Zoom in to see sequence'
```

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
