---
id: trackmenuitemssessionmixin
title: TrackMenuItemsSessionMixin
sidebar_label: Mixin -> TrackMenuItemsSessionMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/TrackMenu.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/TrackMenuItemsSessionMixin.md)

## Overview

The two track-menu wrappers (`getTrackListMenuItems` for the hierarchical
selector, `getTrackActionMenuItems` for the in-view label menu) shared by the
full web and desktop sessions. Both are pure functions of `getTrackActions`,
which each session supplies (web gates on edit rights; desktop adds indexing).

<details open>
<summary>TrackMenuItemsSessionMixin - Methods</summary>

#### method: getTrackListMenuItems

flattened menu items for use in hierarchical track selector

```ts
type getTrackListMenuItems = (config: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>, view?: TrackActionView | undefined) => MenuItem[]
```

#### method: getTrackActionMenuItems

track menu with About + "Track actions" submenu for the in-view label

```ts
type getTrackActionMenuItems = ({ config, effectiveConfig, extraTrackActions, view, }: { config: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>; effectiveConfig: Record<...>; extraTrackActions?: MenuItem[] ...
```

</details>
