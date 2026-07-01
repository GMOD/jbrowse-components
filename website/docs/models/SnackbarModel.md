---
id: snackbarmodel
title: SnackbarModel
sidebar_label: Session -> SnackbarModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/ui/SnackbarModel.tsx)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/SnackbarModel.md)

## Overview

<details open>
<summary>SnackbarModel - Volatiles</summary>

#### volatile: errorDialog

the error currently shown in the stack-trace dialog. Kept off the dialog queue
so it can stack on top of an already-open dialog (e.g. the one whose action
raised the error) instead of waiting behind it

```ts
// type signature
type errorDialog = ErrorDialogState | undefined
// code
errorDialog: undefined as ErrorDialogState | undefined
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                           | Signature                           |
| ------------------------------------------------ | ----------------------------------- |
| [`snackbarMessages`](#volatile-snackbarmessages) | `IObservableArray<SnackbarMessage>` |

</details>

<details>
<summary>SnackbarModel - Volatiles (all signatures)</summary>

#### volatile: snackbarMessages

```ts
// type signature
type snackbarMessages = IObservableArray<SnackbarMessage>
// code
snackbarMessages: observable.array<SnackbarMessage>()
```

</details>

<details open>
<summary>SnackbarModel - Getters</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                             | Signature                      |
| -------------------------------------------------- | ------------------------------ |
| [`snackbarMessageSet`](#getter-snackbarmessageset) | `Map<string, SnackbarMessage>` |

</details>

<details>
<summary>SnackbarModel - Getters (all signatures)</summary>

#### getter: snackbarMessageSet

```ts
type snackbarMessageSet = Map<string, SnackbarMessage>
```

</details>

<details open>
<summary>SnackbarModel - Actions</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                   | Signature                                                                                                               |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [`notify`](#action-notify)                               | `(message: string, level?: NotificationLevel \| undefined, action?: SnackAction \| SnackAction[] \| undefined) => void` |
| [`notifyError`](#action-notifyerror)                     | `(errorMessage: string, error?: unknown, extra?: unknown, action?: SnackAction \| undefined) => void`                   |
| [`setErrorDialog`](#action-seterrordialog)               | `(state: ErrorDialogState \| undefined) => void`                                                                        |
| [`pushSnackbarMessage`](#action-pushsnackbarmessage)     | `(message: string, level?: NotificationLevel \| undefined, actions?: SnackAction[] \| undefined) => void`               |
| [`popSnackbarMessage`](#action-popsnackbarmessage)       | `() => SnackbarMessage \| undefined`                                                                                    |
| [`removeSnackbarMessage`](#action-removesnackbarmessage) | `(message: string) => void`                                                                                             |

</details>

<details>
<summary>SnackbarModel - Actions (all signatures)</summary>

#### action: notify

```ts
type notify = (
  message: string,
  level?: NotificationLevel | undefined,
  action?: SnackAction | SnackAction[] | undefined,
) => void
```

#### action: notifyError

```ts
type notifyError = (
  errorMessage: string,
  error?: unknown,
  extra?: unknown,
  action?: SnackAction | undefined,
) => void
```

#### action: setErrorDialog

```ts
type setErrorDialog = (state: ErrorDialogState | undefined) => void
```

#### action: pushSnackbarMessage

```ts
type pushSnackbarMessage = (
  message: string,
  level?: NotificationLevel | undefined,
  actions?: SnackAction[] | undefined,
) => void
```

#### action: popSnackbarMessage

```ts
type popSnackbarMessage = () => SnackbarMessage | undefined
```

#### action: removeSnackbarMessage

```ts
type removeSnackbarMessage = (message: string) => void
```

</details>
