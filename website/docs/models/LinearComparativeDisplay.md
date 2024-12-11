---
id: linearcomparativedisplay
title: LinearComparativeDisplay
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LinearComparativeDisplay/stateModelFactory.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearComparativeDisplay.md)

## Docs

extends

- [BaseDisplay](../basedisplay)

### LinearComparativeDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearComparativeDisplay">
// code
type: types.literal('LinearComparativeDisplay')
```

#### property: configuration

```js
// type signature
AnyConfigurationSchemaType
// code
configuration: ConfigurationReference(configSchema)
```

### LinearComparativeDisplay - Getters

#### getter: level

```js
// type
number
```

#### getter: height

```js
// type
number
```

#### getter: renderProps

```js
// type
() => { rpcDriverName: string; displayModel: { id: string; type: "LinearComparativeDisplay"; rpcDriverName: string; configuration: { [x: string]: any; } & NonEmptyObject & { ...; } & IStateTreeNode<...>; } & ... 5 more ... & IStateTreeNode<...>; highResolutionScaling: number; }
```

### LinearComparativeDisplay - Actions

#### action: setLoading

controlled by a reaction

```js
// type signature
setLoading: (newStopToken: string) => void
```

#### action: setMessage

controlled by a reaction

```js
// type signature
setMessage: (messageText: string) => void
```

#### action: setRendered

controlled by a reaction

```js
// type signature
setRendered: (args?: { features: Feature[]; }) => void
```

#### action: setError

controlled by a reaction

```js
// type signature
setError: (error: unknown) => void
```
