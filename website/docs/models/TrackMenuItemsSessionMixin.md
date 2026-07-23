---
id: trackmenuitemssessionmixin
title: TrackMenuItemsSessionMixin
sidebar_label: Mixin -> TrackMenuItemsSessionMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/TrackMenu.ts).

## Overview

The two track-menu wrappers (`getTrackListMenuItems` for the hierarchical
selector, `getTrackActionMenuItems` for the in-view label menu) shared by the
full web and desktop sessions. Both are pure functions of `getTrackActions`,
which each session supplies (web gates on edit rights; desktop adds indexing).

## Members

| Member                                                     | Kind    | Defined by                 | Description                                                           |
| ---------------------------------------------------------- | ------- | -------------------------- | --------------------------------------------------------------------- |
| [getTrackListMenuItems](#method-gettracklistmenuitems)     | Methods | TrackMenuItemsSessionMixin | flattened menu items for use in hierarchical track selector           |
| [getTrackActionMenuItems](#method-gettrackactionmenuitems) | Methods | TrackMenuItemsSessionMixin | track menu with About + "Track actions" submenu for the in-view label |

<details>
<summary>TrackMenuItemsSessionMixin - Methods</summary>

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
