---
id: multipleviewssessionmixin
title: MultipleViewsSessionMixin
sidebar_label: Mixin -> MultipleViewsSessionMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/MultipleViews.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/MultipleViewsSessionMixin.md)

## Overview

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseSessionModel](../basesessionmodel)

**Properties:** [id](../basesessionmodel#property-id),
[name](../basesessionmodel#property-name),
[margin](../basesessionmodel#property-margin),
[focusedViewId](../basesessionmodel#property-focusedviewid)

**Volatiles:** [selection](../basesessionmodel#volatile-selection),
[hovered](../basesessionmodel#volatile-hovered),
[queueOfDialogs](../basesessionmodel#volatile-queueofdialogs)

**Getters:** [root](../basesessionmodel#getter-root),
[jbrowse](../basesessionmodel#getter-jbrowse),
[rpcManager](../basesessionmodel#getter-rpcmanager),
[configuration](../basesessionmodel#getter-configuration),
[adminMode](../basesessionmodel#getter-adminmode),
[textSearchManager](../basesessionmodel#getter-textsearchmanager),
[assemblies](../basesessionmodel#getter-assemblies),
[DialogComponent](../basesessionmodel#getter-dialogcomponent),
[DialogProps](../basesessionmodel#getter-dialogprops)

**Actions:** [setSelection](../basesessionmodel#action-setselection),
[clearSelection](../basesessionmodel#action-clearselection),
[setHovered](../basesessionmodel#action-sethovered),
[setName](../basesessionmodel#action-setname),
[setFocusedViewId](../basesessionmodel#action-setfocusedviewid),
[removeActiveDialog](../basesessionmodel#action-removeactivedialog),
[queueDialog](../basesessionmodel#action-queuedialog)

### Available via [SnackbarModel](../snackbarmodel)

**Volatiles:** [snackbarMessages](../snackbarmodel#volatile-snackbarmessages)

**Getters:** [snackbarMessageSet](../snackbarmodel#getter-snackbarmessageset)

**Actions:** [notify](../snackbarmodel#action-notify),
[notifyError](../snackbarmodel#action-notifyerror),
[pushSnackbarMessage](../snackbarmodel#action-pushsnackbarmessage),
[popSnackbarMessage](../snackbarmodel#action-popsnackbarmessage),
[removeSnackbarMessage](../snackbarmodel#action-removesnackbarmessage)

### Available via [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)

**Properties:**
[drawerPosition](../drawerwidgetsessionmixin#property-drawerposition),
[drawerWidth](../drawerwidgetsessionmixin#property-drawerwidth),
[widgets](../drawerwidgetsessionmixin#property-widgets),
[activeWidgets](../drawerwidgetsessionmixin#property-activewidgets),
[minimized](../drawerwidgetsessionmixin#property-minimized)

**Getters:** [visibleWidget](../drawerwidgetsessionmixin#getter-visiblewidget)

**Actions:**
[setDrawerPosition](../drawerwidgetsessionmixin#action-setdrawerposition),
[updateDrawerWidth](../drawerwidgetsessionmixin#action-updatedrawerwidth),
[resizeDrawer](../drawerwidgetsessionmixin#action-resizedrawer),
[addWidget](../drawerwidgetsessionmixin#action-addwidget),
[showWidget](../drawerwidgetsessionmixin#action-showwidget),
[hideWidget](../drawerwidgetsessionmixin#action-hidewidget),
[minimizeWidgetDrawer](../drawerwidgetsessionmixin#action-minimizewidgetdrawer),
[showWidgetDrawer](../drawerwidgetsessionmixin#action-showwidgetdrawer),
[hideAllWidgets](../drawerwidgetsessionmixin#action-hideallwidgets),
[editConfiguration](../drawerwidgetsessionmixin#action-editconfiguration)

<details open>
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">MultipleViewsSessionMixin - Properties</summary>

#### property: views

```js
// type signature
IArrayType<IAnyType>
// code
views: types.array(
          pluginManager.pluggableMstType('view', 'stateModel'),
        )
```

#### property: stickyViewHeaders

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
stickyViewHeaders: types.optional(types.boolean, () =>
          localStorageGetBoolean('stickyViewHeaders', true),
        )
```

#### property: useWorkspaces

enables the dockview-based tabbed/tiled workspace layout

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
useWorkspaces: types.optional(types.boolean, () =>
          localStorageGetBoolean('useWorkspaces', false),
        )
```

</details>

<details open>
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">MultipleViewsSessionMixin - Actions</summary>

#### action: moveViewDown

```js
// type signature
moveViewDown: (id: string) => void
```

#### action: moveViewUp

```js
// type signature
moveViewUp: (id: string) => void
```

#### action: moveViewToTop

```js
// type signature
moveViewToTop: (id: string) => void
```

#### action: moveViewToBottom

```js
// type signature
moveViewToBottom: (id: string) => void
```

#### action: addView

```js
// type signature
addView: (typeName: string, initialState?: any) => any
```

#### action: removeView

```js
// type signature
removeView: (view: IBaseViewModel) => void
```

#### action: setStickyViewHeaders

```js
// type signature
setStickyViewHeaders: (sticky: boolean) => void
```

#### action: setUseWorkspaces

```js
// type signature
setUseWorkspaces: (useWorkspaces: boolean) => void
```

</details>
