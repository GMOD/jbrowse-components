---
id: trackmenusessionmixin
title: TrackMenuSessionMixin
sidebar_label: Mixin -> TrackMenuSessionMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/TrackMenuSessionMixin.ts).

## Overview

The minimal track menus used by the embedded react views, which have no
track-editing actions to offer: just "About track" plus any plugin-contributed
items (`Core-extraTrackMenuItems`). Mirrors the shape of the full
`TrackMenuItemsSessionMixin` so both menu surfaces stay consistent across
products, minus the Settings/Copy/Delete actions.

## Members

| Member                                                     | Kind    | Defined by            | Description                                                 |
| ---------------------------------------------------------- | ------- | --------------------- | ----------------------------------------------------------- |
| [getTrackListMenuItems](#method-gettracklistmenuitems)     | Methods | TrackMenuSessionMixin | flattened menu items for use in hierarchical track selector |
| [getTrackActionMenuItems](#method-gettrackactionmenuitems) | Methods | TrackMenuSessionMixin |                                                             |

<details>
<summary>TrackMenuSessionMixin - Methods</summary>

#### method: getTrackListMenuItems

flattened menu items for use in hierarchical track selector

```ts
type getTrackListMenuItems = (config: ModelInstanceTypeProps<…> & {…} & IStateTreeNode<…>, view?: TrackActionView | undefined) => MenuItem[]
```

</details>

<details>
<summary>TrackMenuSessionMixin - Methods (other undocumented members)</summary>

| Member                                                                   | Type                                                                                                                         |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| <span id="method-gettrackactionmenuitems">getTrackActionMenuItems</span> | `({…}: { config: ModelInstanceTypeProps<…> & {…} & IStateTreeNode<…>; view?: TrackActionView \| undefined; }) => MenuItem[]` |

</details>
