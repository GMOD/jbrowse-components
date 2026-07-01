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

**Volatiles:** [snackbarMessages](../snackbarmodel#volatile-snackbarmessages),
[errorDialog](../snackbarmodel#volatile-errordialog)

**Getters:** [snackbarMessageSet](../snackbarmodel#getter-snackbarmessageset)

**Actions:** [notify](../snackbarmodel#action-notify),
[notifyError](../snackbarmodel#action-notifyerror),
[setErrorDialog](../snackbarmodel#action-seterrordialog),
[pushSnackbarMessage](../snackbarmodel#action-pushsnackbarmessage),
[popSnackbarMessage](../snackbarmodel#action-popsnackbarmessage),
[removeSnackbarMessage](../snackbarmodel#action-removesnackbarmessage)

<details open>
<summary>BaseSessionModel - Properties</summary>

#### property: focusedViewId

used to keep track of which view is in focus

```ts
// type signature
type focusedViewId = IMaybe<ISimpleType<string>>
// code
focusedViewId: types.maybe(types.string)
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                       | Signature                                          |
| ---------------------------- | -------------------------------------------------- |
| [`id`](#property-id)         | `IOptionalIType<ISimpleType<string>, [undefined]>` |
| [`name`](#property-name)     | `ISimpleType<string>`                              |
| [`margin`](#property-margin) | `IOptionalIType<ISimpleType<number>, [undefined]>` |

</details>

<details>
<summary>BaseSessionModel - Properties (all signatures)</summary>

#### property: id

```ts
// type signature
type id = IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: name

```ts
// type signature
type name = ISimpleType<string>
// code
name: types.string
```

#### property: margin

```ts
// type signature
type margin = IOptionalIType<ISimpleType<number>, [undefined]>
// code
margin: types.stripDefault(types.number, 0)
```

</details>

<details open>
<summary>BaseSessionModel - Volatiles</summary>

#### volatile: selection

this is the globally "selected" object. can be anything. code that wants to deal
with this should examine it to see what kind of thing it is.

```ts
// type signature
type selection = unknown
// code
selection: undefined as unknown
```

#### volatile: hovered

this is the globally "hovered" object. can be anything. code that wants to deal
with this should examine it to see what kind of thing it is.

```ts
// type signature
type hovered = unknown
// code
hovered: undefined as unknown
```

#### volatile: preferencesOverrides

runtime user-preference overrides keyed by preference id, resolved by
`getPreference` against the `configuration.preferences` admin defaults. Empty
here (config-only); products that let users edit preferences load and persist
these via localStorage. A runtime override map layered over config defaults,
kept off the snapshot since prefs are local UI.

```ts
// type signature
type preferencesOverrides = Record<string, unknown>
// code
preferencesOverrides: {} as Record<string, unknown>
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                       | Signature                                          |
| -------------------------------------------- | -------------------------------------------------- |
| [`queueOfDialogs`](#volatile-queueofdialogs) | `[DialogComponentType, Record<string, unknown>][]` |

</details>

<details>
<summary>BaseSessionModel - Volatiles (all signatures)</summary>

#### volatile: queueOfDialogs

```ts
// type signature
type queueOfDialogs = [DialogComponentType, Record<string, unknown>][]
// code
queueOfDialogs: [] as [DialogComponentType, Record<string, unknown>][]
```

</details>

<details open>
<summary>BaseSessionModel - Getters</summary>

#### getter: animationMode

resolved feature-layout animation mode (never undefined)

```ts
type animationMode = AnimationMode
```

#### getter: scrollZoom

resolved scroll-to-zoom preference. Global and personal (never shared in a
session snapshot); every wheel-zoom view reads this single value.

```ts
type scrollZoom = boolean
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                           | Signature                                                                                                                                                                                          |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`root`](#getter-root)                           | `TypeOrStateTreeNodeToStateTreeNode<ROOT_MODEL_TYPE>`                                                                                                                                              |
| [`jbrowse`](#getter-jbrowse)                     | `any`                                                                                                                                                                                              |
| [`rpcManager`](#getter-rpcmanager)               | `RpcManager`                                                                                                                                                                                       |
| [`configuration`](#getter-configuration)         | `Instance<JB_CONFIG_SCHEMA>`                                                                                                                                                                       |
| [`adminMode`](#getter-adminmode)                 | `boolean`                                                                                                                                                                                          |
| [`textSearchManager`](#getter-textsearchmanager) | `TextSearchManager`                                                                                                                                                                                |
| [`assemblies`](#getter-assemblies)               | `(ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]` |
| [`DialogComponent`](#getter-dialogcomponent)     | `DialogComponentType`                                                                                                                                                                              |
| [`DialogProps`](#getter-dialogprops)             | `Record<string, unknown>`                                                                                                                                                                          |

</details>

<details>
<summary>BaseSessionModel - Getters (all signatures)</summary>

#### getter: root

```ts
type root = TypeOrStateTreeNodeToStateTreeNode<ROOT_MODEL_TYPE>
```

#### getter: jbrowse

```ts
type jbrowse = any
```

#### getter: rpcManager

```ts
type rpcManager = RpcManager
```

#### getter: configuration

```ts
type configuration = Instance<JB_CONFIG_SCHEMA>
```

#### getter: adminMode

```ts
type adminMode = boolean
```

#### getter: textSearchManager

```ts
type textSearchManager = TextSearchManager
```

#### getter: assemblies

```ts
type assemblies = (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]
```

#### getter: DialogComponent

```ts
type DialogComponent = DialogComponentType
```

#### getter: DialogProps

```ts
type DialogProps = Record<string, unknown>
```

</details>

<details open>
<summary>BaseSessionModel - Methods</summary>

#### method: getPreference

resolved value of a user preference: a runtime override if the user set one,
otherwise the admin/embedder `configuration.preferences` default. The override
map is empty unless the product loads it (web/desktop).

```ts
type getPreference = (key: string) => unknown
```

</details>

<details open>
<summary>BaseSessionModel - Actions</summary>

#### action: setSelection

set the global selection, i.e. the globally-selected object. can be a feature, a
view, just about anything

```ts
type setSelection = (thing: unknown) => void
```

#### action: clearSelection

clears the global selection

```ts
type clearSelection = () => void
```

#### action: setPreferenceOverride

set a runtime user-preference override (see `getPreference`). Mutates volatile
state; products persist these to localStorage.

```ts
type setPreferenceOverride = (key: string, value: unknown) => void
```

#### action: setScrollZoom

set the global scroll-to-zoom preference (see the `scrollZoom` getter)

```ts
type setScrollZoom = (flag: boolean) => void
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                             | Signature                              |
| -------------------------------------------------- | -------------------------------------- |
| [`setHovered`](#action-sethovered)                 | `(thing: unknown) => void`             |
| [`setName`](#action-setname)                       | `(str: string) => void`                |
| [`setFocusedViewId`](#action-setfocusedviewid)     | `(viewId: string) => void`             |
| [`removeActiveDialog`](#action-removeactivedialog) | `() => void`                           |
| [`queueDialog`](#action-queuedialog)               | `(doneCallback: DoneCallback) => void` |

</details>

<details>
<summary>BaseSessionModel - Actions (all signatures)</summary>

#### action: setHovered

```ts
type setHovered = (thing: unknown) => void
```

#### action: setName

```ts
type setName = (str: string) => void
```

#### action: setFocusedViewId

```ts
type setFocusedViewId = (viewId: string) => void
```

#### action: removeActiveDialog

```ts
type removeActiveDialog = () => void
```

#### action: queueDialog

```ts
type queueDialog = (doneCallback: DoneCallback) => void
```

</details>
