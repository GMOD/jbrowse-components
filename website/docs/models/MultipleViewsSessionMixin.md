---
id: multipleviewssessionmixin
title: MultipleViewsSessionMixin
sidebar_label: Mixin -> MultipleViewsSessionMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/MultipleViews.ts).

## Overview

## Members

| Member                                               | Kind       | Description                                              |
| ---------------------------------------------------- | ---------- | -------------------------------------------------------- |
| [views](#property-views)                             | Properties |                                                          |
| [stickyViewHeaders](#property-stickyviewheaders)     | Properties |                                                          |
| [useWorkspaces](#property-useworkspaces)             | Properties | enables the dockview-based tabbed/tiled workspace layout |
| [moveViewDown](#action-moveviewdown)                 | Actions    |                                                          |
| [moveViewUp](#action-moveviewup)                     | Actions    |                                                          |
| [moveViewToTop](#action-moveviewtotop)               | Actions    |                                                          |
| [moveViewToBottom](#action-moveviewtobottom)         | Actions    |                                                          |
| [addView](#action-addview)                           | Actions    |                                                          |
| [removeView](#action-removeview)                     | Actions    |                                                          |
| [setStickyViewHeaders](#action-setstickyviewheaders) | Actions    |                                                          |
| [setUseWorkspaces](#action-setuseworkspaces)         | Actions    |                                                          |

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseSessionModel](../basesessionmodel)

**Properties:** [id](../basesessionmodel#property-id),
[name](../basesessionmodel#property-name),
[margin](../basesessionmodel#property-margin),
[focusedViewId](../basesessionmodel#property-focusedviewid),
[highlightsVisible](../basesessionmodel#property-highlightsvisible)

**Volatiles:** [selection](../basesessionmodel#volatile-selection),
[hovered](../basesessionmodel#volatile-hovered),
[queueOfDialogs](../basesessionmodel#volatile-queueofdialogs),
[preferencesOverrides](../basesessionmodel#volatile-preferencesoverrides)

**Getters:** [root](../basesessionmodel#getter-root),
[jbrowse](../basesessionmodel#getter-jbrowse),
[rpcManager](../basesessionmodel#getter-rpcmanager),
[configuration](../basesessionmodel#getter-configuration),
[adminMode](../basesessionmodel#getter-adminmode),
[textSearchManager](../basesessionmodel#getter-textsearchmanager),
[assemblies](../basesessionmodel#getter-assemblies),
[DialogComponent](../basesessionmodel#getter-dialogcomponent),
[DialogProps](../basesessionmodel#getter-dialogprops),
[animationMode](../basesessionmodel#getter-animationmode),
[scrollZoom](../basesessionmodel#getter-scrollzoom)

**Methods:** [getPreference](../basesessionmodel#method-getpreference),
[getDisplayTypeDefault](../basesessionmodel#method-getdisplaytypedefault)

**Actions:** [setSelection](../basesessionmodel#action-setselection),
[clearSelection](../basesessionmodel#action-clearselection),
[setHovered](../basesessionmodel#action-sethovered),
[setHighlightsVisible](../basesessionmodel#action-sethighlightsvisible),
[setPreferenceOverride](../basesessionmodel#action-setpreferenceoverride),
[clearPreferenceOverrides](../basesessionmodel#action-clearpreferenceoverrides),
[setScrollZoom](../basesessionmodel#action-setscrollzoom),
[setDisplayTypeDefault](../basesessionmodel#action-setdisplaytypedefault),
[setName](../basesessionmodel#action-setname),
[setFocusedViewId](../basesessionmodel#action-setfocusedviewid),
[removeActiveDialog](../basesessionmodel#action-removeactivedialog),
[queueDialog](../basesessionmodel#action-queuedialog)

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

<details>
<summary>MultipleViewsSessionMixin - Properties</summary>

#### property: useWorkspaces

enables the dockview-based tabbed/tiled workspace layout

```ts
// type signature
type useWorkspaces = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
useWorkspaces: types.optional(types.boolean, () =>
  localStorageGetBoolean('useWorkspaces', false),
)
```

</details>

<details>
<summary>MultipleViewsSessionMixin - Properties (other undocumented members)</summary>

#### property: views

```ts
// type signature
type views = IArrayType<IAnyType>
// code
views: types.array(pluginManager.pluggableMstType('view', 'stateModel'))
```

#### property: stickyViewHeaders

```ts
// type signature
type stickyViewHeaders = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
stickyViewHeaders: types.optional(types.boolean, () =>
  localStorageGetBoolean('stickyViewHeaders', true),
)
```

</details>

<details>
<summary>MultipleViewsSessionMixin - Actions</summary>

#### action: moveViewDown

```ts
type moveViewDown = (id: string) => void
```

#### action: moveViewUp

```ts
type moveViewUp = (id: string) => void
```

#### action: moveViewToTop

```ts
type moveViewToTop = (id: string) => void
```

#### action: moveViewToBottom

```ts
type moveViewToBottom = (id: string) => void
```

#### action: addView

```ts
type addView = (typeName: string, initialState?: any) => any
```

#### action: removeView

```ts
type removeView = (view: IBaseViewModel) => void
```

#### action: setStickyViewHeaders

```ts
type setStickyViewHeaders = (sticky: boolean) => void
```

#### action: setUseWorkspaces

```ts
type setUseWorkspaces = (useWorkspaces: boolean) => void
```

</details>
