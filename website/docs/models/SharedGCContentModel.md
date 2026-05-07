---
id: sharedgccontentmodel
title: SharedGCContentModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gccontent/src/LinearGCContentDisplay/shared.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/SharedGCContentModel.md)

## Docs

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

#### method: adapterProps

retrieves the sequence adapter from parent track, and puts it as a subadapter on
a GCContentAdapter

```js
// type signature
adapterProps: () => any
```
