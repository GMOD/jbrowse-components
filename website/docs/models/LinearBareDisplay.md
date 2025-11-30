---
id: linearbaredisplay
title: LinearBareDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/LinearBareDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearBareDisplay.md)

## Docs

extends

- [BaseLinearDisplay](../baselineardisplay)

### LinearBareDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearBareDisplay">
// code
type: types.literal('LinearBareDisplay')
```

#### property: configuration

```js
// type signature
AnyConfigurationSchemaType
// code
configuration: ConfigurationReference(configSchema)
```

### LinearBareDisplay - Getters

#### getter: rendererConfig

```js
// type
{ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>
```

#### getter: rendererTypeName

```js
// type
any
```

### LinearBareDisplay - Methods

#### method: renderProps

```js
// type signature
renderProps: () => any
```
