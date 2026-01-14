---
id: lineararcdisplay
title: LinearArcDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/arc/src/LinearArcDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearArcDisplay.md)

## Docs

extends

- [BaseLinearDisplay](../baselineardisplay)

### LinearArcDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearArcDisplay">
// code
type: types.literal('LinearArcDisplay')
```

#### property: configuration

```js
// type signature
any
// code
configuration: ConfigurationReference(configSchema)
```

#### property: displayMode

```js
// type signature
IMaybe<ISimpleType<string>>
// code
displayMode: types.maybe(types.string)
```

### LinearArcDisplay - Getters

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

#### getter: displayModeSetting

```js
// type
any
```

#### getter: rendererConfig

```js
// type
{
  displayMode: any
}
```

### LinearArcDisplay - Methods

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

### LinearArcDisplay - Actions

#### action: setDisplayMode

```js
// type signature
setDisplayMode: (flag: string) => void
```
