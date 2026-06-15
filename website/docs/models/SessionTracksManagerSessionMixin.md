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

**Actions:** addTrackConf, updateTrackConfiguration, deleteTrackConf

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

**Methods:** getReferring, getReferringMultiple

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

Session tracks come first and shadow any config (jbrowse.tracks) track with the
same trackId, so a non-admin's edits to a config track (stored as a same-id
session override, see updateTrackConfiguration) replace the original everywhere
it's resolved without showing a duplicate.

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

#### action: updateTrackConfiguration

Persist edited track config. Admins edit the jbrowse config in place; everyone
else gets a session-track override (same trackId) so the edits persist with the
session and are shared, instead of being a throwaway in-memory mutation of an
admin-owned config track.

```js
// type signature
updateTrackConfiguration: (trackConf: { [key: string]: unknown; trackId: string; }) => void
```

#### action: resetTrackConfiguration

Drop a session-track override (see updateTrackConfiguration) so the track
reverts to its underlying config (jbrowse.tracks) default. Unlike
deleteTrackConf this does not dereference the track from open views — the
same-trackId config track re-resolves in place, so an open track stays open and
simply reverts.

```js
// type signature
resetTrackConfiguration: (trackId: string) => void
```

#### action: deleteTrackConf

```js
// type signature
deleteTrackConf: (trackConf: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => any[] | undefined
```
