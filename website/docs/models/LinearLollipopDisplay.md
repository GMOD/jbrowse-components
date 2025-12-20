---
id: linearlollipopdisplay
title: LinearLollipopDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/lollipop/src/LinearLollipopDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearLollipopDisplay.md)

## Docs

extends

- [BaseLinearDisplay](../baselineardisplay)

### LinearLollipopDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearLollipopDisplay">
// code
type: types.literal('LinearLollipopDisplay')
```

#### property: configuration

```js
// type signature
AnyConfigurationSchemaType
// code
configuration: ConfigurationReference(configSchema)
```

### LinearLollipopDisplay - Getters

#### getter: blockType

```js
// type
string
```

#### getter: renderDelay

```js
// type
number
```

#### getter: rendererTypeName

```js
// type
any
```

### LinearLollipopDisplay - Methods

#### method: renderProps

```js
// type signature
renderProps: () => any
```
