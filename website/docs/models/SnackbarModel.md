---
id: snackbarmodel
title: SnackbarModel
sidebar_label: Session -> SnackbarModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/ui/SnackbarModel.tsx).

## Overview

## Members

| Member                                                 | Kind      | Defined by    | Description                                          |
| ------------------------------------------------------ | --------- | ------------- | ---------------------------------------------------- |
| [snackbarMessages](#volatile-snackbarmessages)         | Volatiles | SnackbarModel |                                                      |
| [errorDialog](#volatile-errordialog)                   | Volatiles | SnackbarModel | the error currently shown in the stack-trace dialog. |
| [snackbarMessageSet](#getter-snackbarmessageset)       | Getters   | SnackbarModel |                                                      |
| [notify](#action-notify)                               | Actions   | SnackbarModel |                                                      |
| [notifyError](#action-notifyerror)                     | Actions   | SnackbarModel |                                                      |
| [setErrorDialog](#action-seterrordialog)               | Actions   | SnackbarModel |                                                      |
| [pushSnackbarMessage](#action-pushsnackbarmessage)     | Actions   | SnackbarModel |                                                      |
| [popSnackbarMessage](#action-popsnackbarmessage)       | Actions   | SnackbarModel |                                                      |
| [removeSnackbarMessage](#action-removesnackbarmessage) | Actions   | SnackbarModel |                                                      |

<details>
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

</details>

<details>
<summary>SnackbarModel - Volatiles (other undocumented members)</summary>

| Member                                                       | Type                                |
| ------------------------------------------------------------ | ----------------------------------- |
| <span id="volatile-snackbarmessages">snackbarMessages</span> | `IObservableArray<SnackbarMessage>` |

</details>

<details>
<summary>SnackbarModel - Getters</summary>

| Member                                                         | Type                           |
| -------------------------------------------------------------- | ------------------------------ |
| <span id="getter-snackbarmessageset">snackbarMessageSet</span> | `Map<string, SnackbarMessage>` |

</details>

<details>
<summary>SnackbarModel - Actions</summary>

| Member                                                               | Type                                                                                                                    |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| <span id="action-notify">notify</span>                               | `(message: string, level?: NotificationLevel \| undefined, action?: SnackAction \| SnackAction[] \| undefined) => void` |
| <span id="action-notifyerror">notifyError</span>                     | `(errorMessage: string, error?: unknown, extra?: unknown, action?: SnackAction \| undefined) => void`                   |
| <span id="action-seterrordialog">setErrorDialog</span>               | `(state: ErrorDialogState \| undefined) => void`                                                                        |
| <span id="action-pushsnackbarmessage">pushSnackbarMessage</span>     | `(message: string, level?: NotificationLevel \| undefined, actions?: SnackAction[] \| undefined) => void`               |
| <span id="action-popsnackbarmessage">popSnackbarMessage</span>       | `() => SnackbarMessage \| undefined`                                                                                    |
| <span id="action-removesnackbarmessage">removeSnackbarMessage</span> | `(message: string) => void`                                                                                             |

</details>
