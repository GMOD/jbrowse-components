---
id: trackmenusessionmixin
title: TrackMenuSessionMixin
sidebar_label: Mixin -> TrackMenuSessionMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/TrackMenuSessionMixin.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/TrackMenuSessionMixin.md)

## Overview

The minimal track menus used by the embedded react views, which have no
track-editing actions to offer: just "About track" plus any plugin-contributed
items (`Core-extraTrackMenuItems`). Mirrors the shape of the full
`TrackMenuItemsSessionMixin` so both menu surfaces stay consistent across
products, minus the Settings/Copy/Delete actions.

<details open>
<summary>TrackMenuSessionMixin - Methods</summary>

#### method: getTrackListMenuItems

flattened menu items for use in hierarchical track selector

```ts
type getTrackListMenuItems = (config: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>, view?: TrackActionView | undefined) => MenuItem[]
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                       | Signature                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`getTrackActionMenuItems`](#method-gettrackactionmenuitems) | `({ config, view, }: { config: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>; view?: TrackActionView \| undefined; }) => MenuItem[]` |

</details>

<details>
<summary>TrackMenuSessionMixin - Methods (all signatures)</summary>

#### method: getTrackActionMenuItems

```ts
type getTrackActionMenuItems = ({ config, view, }: { config: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>; view?: TrackActionView | undefined; }) => MenuItem[]
```

</details>
