---
id: drawerwidgetsessionmixin
title: DrawerWidgetSessionMixin
sidebar_label: Mixin -> DrawerWidgetSessionMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/DrawerWidgets.ts).

## Overview

## Members

| Member                                               | Kind       | Defined by               | Description                                                                                               |
| ---------------------------------------------------- | ---------- | ------------------------ | --------------------------------------------------------------------------------------------------------- |
| [drawerPosition](#property-drawerposition)           | Properties | DrawerWidgetSessionMixin |                                                                                                           |
| [drawerWidth](#property-drawerwidth)                 | Properties | DrawerWidgetSessionMixin |                                                                                                           |
| [widgets](#property-widgets)                         | Properties | DrawerWidgetSessionMixin |                                                                                                           |
| [activeWidgets](#property-activewidgets)             | Properties | DrawerWidgetSessionMixin |                                                                                                           |
| [minimized](#property-minimized)                     | Properties | DrawerWidgetSessionMixin |                                                                                                           |
| [poppedOut](#volatile-poppedout)                     | Volatiles  | DrawerWidgetSessionMixin | true while the visible widget is shown in a modal dialog instead of the drawer.                           |
| [visibleWidget](#getter-visiblewidget)               | Getters    | DrawerWidgetSessionMixin |                                                                                                           |
| [setDrawerPosition](#action-setdrawerposition)       | Actions    | DrawerWidgetSessionMixin |                                                                                                           |
| [updateDrawerWidth](#action-updatedrawerwidth)       | Actions    | DrawerWidgetSessionMixin |                                                                                                           |
| [resizeDrawer](#action-resizedrawer)                 | Actions    | DrawerWidgetSessionMixin |                                                                                                           |
| [addWidget](#action-addwidget)                       | Actions    | DrawerWidgetSessionMixin |                                                                                                           |
| [showWidget](#action-showwidget)                     | Actions    | DrawerWidgetSessionMixin |                                                                                                           |
| [hideWidget](#action-hidewidget)                     | Actions    | DrawerWidgetSessionMixin |                                                                                                           |
| [minimizeWidgetDrawer](#action-minimizewidgetdrawer) | Actions    | DrawerWidgetSessionMixin |                                                                                                           |
| [showWidgetDrawer](#action-showwidgetdrawer)         | Actions    | DrawerWidgetSessionMixin |                                                                                                           |
| [popoutWidget](#action-popoutwidget)                 | Actions    | DrawerWidgetSessionMixin | show the visible widget in a modal dialog, freeing the drawer column                                      |
| [returnWidgetToDrawer](#action-returnwidgettodrawer) | Actions    | DrawerWidgetSessionMixin |                                                                                                           |
| [hideAllWidgets](#action-hideallwidgets)             | Actions    | DrawerWidgetSessionMixin |                                                                                                           |
| [editConfiguration](#action-editconfiguration)       | Actions    | DrawerWidgetSessionMixin | opens a configuration editor to configure the given thing, and sets the current task to be configuring it |

<details>
<summary>DrawerWidgetSessionMixin - Properties</summary>

| Member                                                   | Type                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------- |
| <span id="property-drawerposition">drawerPosition</span> | `IOptionalIType<ISimpleType<string>, [undefined]>`                        |
| <span id="property-drawerwidth">drawerWidth</span>       | `IOptionalIType<ISimpleType<number>, [undefined]>`                        |
| <span id="property-widgets">widgets</span>               | `IOptionalIType<IMapType<IAnyType>, [undefined]>`                         |
| <span id="property-activewidgets">activeWidgets</span>   | `IOptionalIType<IMapType<IMaybe<IReferenceType<IAnyType>>>, [undefined]>` |
| <span id="property-minimized">minimized</span>           | `IOptionalIType<ISimpleType<boolean>, [undefined]>`                       |

</details>

<details>
<summary>DrawerWidgetSessionMixin - Volatiles</summary>

#### volatile: poppedOut

true while the visible widget is shown in a modal dialog instead of the drawer.
Volatile because a restored session that opened straight into a modal, with no
drawer behind it, is disorienting

```ts
// type signature
type poppedOut = false
// code
poppedOut: false
```

</details>

<details>
<summary>DrawerWidgetSessionMixin - Getters</summary>

| Member                                               | Type  |
| ---------------------------------------------------- | ----- |
| <span id="getter-visiblewidget">visibleWidget</span> | `any` |

</details>

<details>
<summary>DrawerWidgetSessionMixin - Actions</summary>

#### action: popoutWidget

show the visible widget in a modal dialog, freeing the drawer column

```ts
type popoutWidget = () => void
```

#### action: editConfiguration

opens a configuration editor to configure the given thing, and sets the current
task to be configuring it

```ts
type editConfiguration = (configuration: (ModelInstanceTypeProps<…> & {…} & IStateTreeNode<…>) | { ...; }, opts?: { ...; } | undefined) => void
```

</details>

<details>
<summary>DrawerWidgetSessionMixin - Actions (other undocumented members)</summary>

| Member                                                             | Type                                                                        |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| <span id="action-setdrawerposition">setDrawerPosition</span>       | `(arg: string) => void`                                                     |
| <span id="action-updatedrawerwidth">updateDrawerWidth</span>       | `(drawerWidth: number) => number`                                           |
| <span id="action-resizedrawer">resizeDrawer</span>                 | `(distance: number) => number`                                              |
| <span id="action-addwidget">addWidget</span>                       | `(typeName: string, id: string, initialState?: any, conf?: unknown) => any` |
| <span id="action-showwidget">showWidget</span>                     | `(widget: any) => void`                                                     |
| <span id="action-hidewidget">hideWidget</span>                     | `(widget: any) => void`                                                     |
| <span id="action-minimizewidgetdrawer">minimizeWidgetDrawer</span> | `() => void`                                                                |
| <span id="action-showwidgetdrawer">showWidgetDrawer</span>         | `() => void`                                                                |
| <span id="action-returnwidgettodrawer">returnWidgetToDrawer</span> | `() => void`                                                                |
| <span id="action-hideallwidgets">hideAllWidgets</span>             | `() => void`                                                                |

</details>
