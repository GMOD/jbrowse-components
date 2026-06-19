---
id: basesessionmodel
title: BaseSessionModel
sidebar_label: Session -> BaseSessionModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/BaseSession.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/BaseSessionModel.md)

## Overview

base session shared by all JBrowse products. Be careful what you include here,
everything will use it.

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [SnackbarModel](../snackbarmodel)

**Volatiles:** [snackbarMessages](../snackbarmodel#volatile-snackbarmessages)

**Getters:** [snackbarMessageSet](../snackbarmodel#getter-snackbarmessageset)

**Actions:** [notify](../snackbarmodel#action-notify),
[notifyError](../snackbarmodel#action-notifyerror),
[pushSnackbarMessage](../snackbarmodel#action-pushsnackbarmessage),
[popSnackbarMessage](../snackbarmodel#action-popsnackbarmessage),
[removeSnackbarMessage](../snackbarmodel#action-removesnackbarmessage)

<details>
<summary>BaseSessionModel - Properties</summary>

#### property: id

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: name

```js
// type signature
ISimpleType<string>
// code
name: types.string
```

#### property: margin

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
margin: types.stripDefault(types.number, 0)
```

#### property: focusedViewId

used to keep track of which view is in focus

```js
// type signature
IMaybe<ISimpleType<string>>
// code
focusedViewId: types.maybe(types.string)
```

</details>

<details>
<summary>BaseSessionModel - Volatiles</summary>

#### volatile: selection

this is the globally "selected" object. can be anything. code that wants to deal
with this should examine it to see what kind of thing it is.

```js
// type signature
unknown
// code
selection: undefined as unknown
```

#### volatile: hovered

this is the globally "hovered" object. can be anything. code that wants to deal
with this should examine it to see what kind of thing it is.

```js
// type signature
unknown
// code
hovered: undefined as unknown
```

#### volatile: queueOfDialogs

```js
// type signature
[DialogComponentType, Record<string, unknown>][]
// code
queueOfDialogs: [] as [DialogComponentType, Record<string, unknown>][]
```

</details>

<details>
<summary>BaseSessionModel - Getters</summary>

#### getter: root

```js
// type
TypeOrStateTreeNodeToStateTreeNode<ROOT_MODEL_TYPE>
```

#### getter: jbrowse

```js
// type
any
```

#### getter: rpcManager

```js
// type
RpcManager
```

#### getter: configuration

```js
// type
Instance<JB_CONFIG_SCHEMA>
```

#### getter: adminMode

```js
// type
boolean
```

#### getter: textSearchManager

```js
// type
TextSearchManager
```

#### getter: assemblies

```js
// type
(ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]
```

#### getter: DialogComponent

```js
// type
DialogComponentType
```

#### getter: DialogProps

```js
// type
Record<string, unknown>
```

</details>

<details>
<summary>BaseSessionModel - Actions</summary>

#### action: setSelection

set the global selection, i.e. the globally-selected object. can be a feature, a
view, just about anything

```js
// type signature
setSelection: (thing: unknown) => void
```

#### action: clearSelection

clears the global selection

```js
// type signature
clearSelection: () => void
```

#### action: setHovered

```js
// type signature
setHovered: (thing: unknown) => void
```

#### action: setName

```js
// type signature
setName: (str: string) => void
```

#### action: setFocusedViewId

```js
// type signature
setFocusedViewId: (viewId: string) => void
```

#### action: removeActiveDialog

```js
// type signature
removeActiveDialog: () => void
```

#### action: queueDialog

```js
// type signature
queueDialog: (doneCallback: DoneCallback) => void
```

</details>
