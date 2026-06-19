---
id: desktopsessiontrackmenumixin
title: DesktopSessionTrackMenuMixin
sidebar_label: Mixin -> DesktopSessionTrackMenuMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-desktop/src/sessionModel/TrackMenu.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/DesktopSessionTrackMenuMixin.md)

## Overview

<details open>
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">DesktopSessionTrackMenuMixin - Methods</summary>

#### method: getTrackActions

raw track actions (Settings, Copy, Delete, Index) without submenu wrapper

```js
// type signature
getTrackActions: (trackConfig: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>, view?: TrackActionView | undefined) => MenuItem[]
```

#### method: getTrackListMenuItems

flattened menu items for use in hierarchical track selector

```js
// type signature
getTrackListMenuItems: (trackConfig: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>, view?: TrackActionView | undefined) => MenuItem[]
```

#### method: getTrackActionMenuItems

```js
// type signature
getTrackActionMenuItems: ({ config, effectiveConfig, extraTrackActions, view, }: { config: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>; effectiveConfig: Record<...>; extraTrackActions?: MenuItem[] ...
```

</details>
