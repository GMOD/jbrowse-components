---
id: sharedgccontentmodel
title: SharedGCContentModel
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[plugins/gccontent/src/LinearGCContentDisplay/shared.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gccontent/src/LinearGCContentDisplay/shared.ts)

extends

- [LinearWiggleDisplay](../linearwiggledisplay)

### SharedGCContentModel - Properties

#### property: windowSize

```js
// type signature
IMaybe<ISimpleType<number>>
// code
windowSize: types.maybe(types.number)
```

#### property: windowDelta

```js
// type signature
IMaybe<ISimpleType<number>>
// code
windowDelta: types.maybe(types.number)
```

### SharedGCContentModel - Methods

#### method: renderProps

retrieves the sequence adapter from parent track, and puts it as a subadapter on
a GCContentAdapter

```js
// type signature
renderProps: () => any
```
