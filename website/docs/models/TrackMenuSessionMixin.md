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

The minimal in-view track-label menu (just "About track" plus any
plugin-contributed extra actions) used by the embedded react views, which have
no track-editing actions to offer.

<details open>
<summary>TrackMenuSessionMixin - Methods</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                       | Signature                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`getTrackActionMenuItems`](#method-gettrackactionmenuitems) | `({ effectiveConfig, extraTrackActions, }: { config: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>; effectiveConfig: Record<...>; extraTrackActions?: MenuItem[] \| undefined; v...` |

</details>

<details>
<summary>TrackMenuSessionMixin - Methods (all signatures)</summary>

#### method: getTrackActionMenuItems

```ts
type getTrackActionMenuItems = ({ effectiveConfig, extraTrackActions, }: { config: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>; effectiveConfig: Record<...>; extraTrackActions?: MenuItem[] | undefined; v...
```

</details>
