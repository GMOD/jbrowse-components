---
id: linearcomparativedisplay
title: LinearComparativeDisplay
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[plugins/linear-comparative-view/src/LinearComparativeDisplay/stateModelFactory.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LinearComparativeDisplay/stateModelFactory.ts)

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

#### property: height

```js
// type signature
number
// code
height: 100
```

### LinearComparativeDisplay - Getters

#### getter: renderProps

```js
// type
() => { rpcDriverName: string; displayModel: { id: string; type: "LinearComparativeDisplay"; rpcDriverName: string; configuration: { [x: string]: any; } & NonEmptyObject & { ...; } & IStateTreeNode<...>; height: number; } & ... 5 more ... & IStateTreeNode<...>; highResolutionScaling: number; }
```

### LinearComparativeDisplay - Actions

#### action: setLoading

controlled by a reaction

```js
// type signature
setLoading: (abortController: AbortController) => void
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
