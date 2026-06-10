---
id: tracksmanagersessionmixin
title: TracksManagerSessionMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/Tracks.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/TracksManagerSessionMixin.md)

## Overview

composed of

- BaseSessionModel
- ReferenceManagementSessionMixin

### TracksManagerSessionMixin - Getters

#### getter: tracks

```js
// type
(ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]
```

#### getter: getTracksById

Map of trackId → config for all tracks, assemblies, and connections. Frozen
jbrowse.tracks are returned as plain objects here; hydration to MST models
happens lazily in TrackConfigurationReference on first access. MobX caches this
until any dependency changes.

```js
// type
() => Record<string, ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>>
```

#### getter: tracksById

MobX-cached map of trackId → config for all tracks, assemblies, and connections.
Recomputes only when dependencies change.

```js
// type
Record<string, ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>>
```

### TracksManagerSessionMixin - Actions

#### action: addTrackConf

```js
// type signature
addTrackConf: (trackConf: AnyConfiguration) => any
```

#### action: deleteTrackConf

```js
// type signature
deleteTrackConf: (trackConf: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => any
```
