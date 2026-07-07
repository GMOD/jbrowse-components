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

| Member                                     | Kind    | Description                                                               |
| ------------------------------------------ | ------- | ------------------------------------------------------------------------- |
| [getTrackActions](#method-gettrackactions) | Methods | raw track actions (Settings, Copy, Delete, Index) without submenu wrapper |

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [TrackMenuItemsSessionMixin](../trackmenuitemssessionmixin)

**Methods:**
[getTrackListMenuItems](../trackmenuitemssessionmixin#method-gettracklistmenuitems),
[getTrackActionMenuItems](../trackmenuitemssessionmixin#method-gettrackactionmenuitems)

<details>
<summary>DesktopSessionTrackMenuMixin - Methods</summary>

#### method: getTrackActions

raw track actions (Settings, Copy, Delete, Index) without submenu wrapper

```ts
type getTrackActions = (trackConfig: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>, view?: TrackActionView | undefined) => MenuItem[]
```

</details>
