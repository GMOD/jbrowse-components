---
id: desktopsessiontrackmenumixin
title: DesktopSessionTrackMenuMixin
sidebar_label: Mixin -> DesktopSessionTrackMenuMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-desktop/src/sessionModel/TrackMenu.ts).

## Overview

## Members

| Member                                                     | Kind    | Defined by                                                  | Description                                                               |
| ---------------------------------------------------------- | ------- | ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| [getTrackActions](#method-gettrackactions)                 | Methods | DesktopSessionTrackMenuMixin                                | raw track actions (Settings, Copy, Delete, Index) without submenu wrapper |
| [getTrackListMenuItems](#method-gettracklistmenuitems)     | Methods | [TrackMenuItemsSessionMixin](../trackmenuitemssessionmixin) | flattened menu items for use in hierarchical track selector               |
| [getTrackActionMenuItems](#method-gettrackactionmenuitems) | Methods | [TrackMenuItemsSessionMixin](../trackmenuitemssessionmixin) | track menu with About + "Track actions" submenu for the in-view label     |

<details>
<summary>DesktopSessionTrackMenuMixin - Methods</summary>

#### method: getTrackActions

raw track actions (Settings, Copy, Delete, Index) without submenu wrapper

```ts
type getTrackActions = (trackConfig: ModelInstanceTypeProps<…> & {…} & IStateTreeNode<…>, view?: TrackActionView | undefined) => MenuItem[]
```

</details>

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from TrackMenuItemsSessionMixin</summary>

[TrackMenuItemsSessionMixin →](../trackmenuitemssessionmixin)

**Methods**

#### method: getTrackListMenuItems

flattened menu items for use in hierarchical track selector

```ts
type getTrackListMenuItems = (config: ModelInstanceTypeProps<…> & {…} & IStateTreeNode<…>, view?: TrackActionView | undefined) => MenuItem[]
```

#### method: getTrackActionMenuItems

track menu with About + "Track actions" submenu for the in-view label

```ts
type getTrackActionMenuItems = ({…}: { config: ModelInstanceTypeProps<…> & {…} & IStateTreeNode<…>; view?: TrackActionView | undefined; }) => MenuItem[]
```

</details>
