---
id: sessiontracksmanagersessionmixin
title: SessionTracksManagerSessionMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/SessionTracks.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/SessionTracksManagerSessionMixin.md)

## Overview

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [TracksManagerSessionMixin](../tracksmanagersessionmixin)

**Getters:** tracks, getTracksById, tracksById

**Actions:** addTrackConf, deleteTrackConf

### Available via [BaseSessionModel](../basesessionmodel)

**Properties:** id, name, margin, focusedViewId

**Volatiles:** selection, hovered, queueOfDialogs

**Getters:** root, jbrowse, rpcManager, configuration, adminMode,
textSearchManager, assemblies, DialogComponent, DialogProps

**Actions:** setSelection, clearSelection, setHovered, setName,
setFocusedViewId, removeActiveDialog, queueDialog

### Available via [SnackbarModel](../snackbarmodel)

**Volatiles:** snackbarMessages

**Getters:** snackbarMessageSet

**Actions:** notify, notifyError, pushSnackbarMessage, popSnackbarMessage,
removeSnackbarMessage

### Available via [ReferenceManagementSessionMixin](../referencemanagementsessionmixin)

**Methods:** getReferring

**Actions:** removeReferring

### SessionTracksManagerSessionMixin - Properties

#### property: sessionTracks

```js
// type signature
IOptionalIType<IArrayType<IAnyModelType>, [undefined]>
// code
sessionTracks: types.stripDefault(
        types.array(pluginManager.pluggableConfigSchemaType('track')),
        [],
      )
```

### SessionTracksManagerSessionMixin - Getters

#### getter: tracks

```js
// type
(ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]
```

### SessionTracksManagerSessionMixin - Actions

#### action: addTrackConf

```js
// type signature
addTrackConf: (trackConf: AnyConfiguration) => any
```

#### action: deleteTrackConf

```js
// type signature
deleteTrackConf: (trackConf: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => any[] | undefined
```
