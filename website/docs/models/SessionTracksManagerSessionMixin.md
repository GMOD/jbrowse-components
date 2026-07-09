---
id: sessiontracksmanagersessionmixin
title: SessionTracksManagerSessionMixin
sidebar_label: Mixin -> SessionTracksManagerSessionMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/SessionTracks.ts).

## Overview

## Members

| Member                                                       | Kind       | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [sessionTracks](#property-sessiontracks)                     | Properties | User-added session tracks (no matching admin config track). A non-admin's _edits_ to an existing config track are stored as deltas (trackConfigDeltas), not here.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [trackConfigDeltas](#property-trackconfigdeltas)             | Properties | Per-track config overrides for a non-admin, keyed by trackId, stored as a _delta_ against the admin-owned base config (jbrowse.tracks entry) rather than a full copy — so a later admin change to an untouched field still flows through (see trackConfigDelta.ts). Frozen (not a typed track array) on purpose: a typed create() would fill defaults, erasing the "unset vs default" distinction the delta merge relies on.                                                                                                                                                                                                                                                                                                                                         |
| [editableTrackConfigs](#volatile-editabletrackconfigs)       | Volatiles  | Per-track private working copies (non-admin), keyed by trackId. A plain Map — not observable, not persisted — mirroring the pluginManager hydration cache: it holds the live MST config node a shown track's in-place quick-edits mutate, so the shared frozen base is never touched. See agent-docs/ADR-032. Not evicted: it's a pure memoization cache, bounded by the count of distinct tracks shown this session (each entry a lazily-hydrated config node), holding no authoritative state — the persisted delta is the source of truth, and reset/programmatic edits keep a retained copy in sync. Retention is volatile RAM only (never serialized), so it's not worth a reference-counted prune at every track-removal path. |
| [tracks](#getter-tracks)                                     | Getters    | User-added session tracks first, then each admin config track with its delta (trackConfigDeltas) merged over it. A base track without a delta is returned unchanged by identity to keep the hydration cache warm.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [getTrackConfigChanges](#method-gettrackconfigchanges)       | Methods    | The overridden slots for `trackId` (empty when it has no delta): each changed setting's path, its base/default value and the edited value. Drives the "view changes" dialog opened from the edited badge.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [getEditableTrackConfig](#method-geteditabletrackconfig)     | Methods    | A non-admin's private working copy of a track config, created on first access from the current frozen (base+delta) value and cached by trackId, so a shown track's in-place quick-edits (setSlot) mutate this copy and never the shared frozen base node (see ADR-032). Undefined in admin mode — there the base jbrowse.tracks entry is edited in place. Called by TrackConfigurationReference during lazy hydration.                                                                                                                                                                                                                                                                                                                                               |
| [addTrackConf](#action-addtrackconf)                         | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [updateTrackConfiguration](#action-updatetrackconfiguration) | Actions    | Persist an edited track config. Admins edit the jbrowse config in place; everyone else gets a delta (trackConfigDeltas) against the admin-owned base — only the changed slots — so the edits persist and are shared while admin changes to untouched fields still flow through. A user-added session track (no base) keeps living in sessionTracks.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [resetTrackConfiguration](#action-resettrackconfiguration)   | Actions    | Drop a non-admin's delta (trackConfigDeltas) so the track reverts to its admin config (jbrowse.tracks) default. Unlike deleteTrackConf this does not dereference the track from open views — the base config re-resolves in place, so an open track stays open and simply reverts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [deleteTrackConf](#action-deletetrackconf)                   | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [TracksManagerSessionMixin](../tracksmanagersessionmixin)

**Getters:** [tracks](../tracksmanagersessionmixin#getter-tracks),
[getTracksById](../tracksmanagersessionmixin#getter-gettracksbyid),
[tracksById](../tracksmanagersessionmixin#getter-tracksbyid)

**Actions:** [addTrackConf](../tracksmanagersessionmixin#action-addtrackconf),
[updateTrackConfiguration](../tracksmanagersessionmixin#action-updatetrackconfiguration),
[deleteTrackConf](../tracksmanagersessionmixin#action-deletetrackconf)

### Available via [BaseSessionModel](../basesessionmodel)

**Properties:** [id](../basesessionmodel#property-id),
[name](../basesessionmodel#property-name),
[margin](../basesessionmodel#property-margin),
[focusedViewId](../basesessionmodel#property-focusedviewid)

**Volatiles:** [selection](../basesessionmodel#volatile-selection),
[hovered](../basesessionmodel#volatile-hovered),
[queueOfDialogs](../basesessionmodel#volatile-queueofdialogs),
[preferencesOverrides](../basesessionmodel#volatile-preferencesoverrides)

**Getters:** [root](../basesessionmodel#getter-root),
[jbrowse](../basesessionmodel#getter-jbrowse),
[rpcManager](../basesessionmodel#getter-rpcmanager),
[configuration](../basesessionmodel#getter-configuration),
[adminMode](../basesessionmodel#getter-adminmode),
[textSearchManager](../basesessionmodel#getter-textsearchmanager),
[assemblies](../basesessionmodel#getter-assemblies),
[DialogComponent](../basesessionmodel#getter-dialogcomponent),
[DialogProps](../basesessionmodel#getter-dialogprops),
[animationMode](../basesessionmodel#getter-animationmode),
[scrollZoom](../basesessionmodel#getter-scrollzoom)

**Methods:** [getPreference](../basesessionmodel#method-getpreference),
[getDisplayTypeDefault](../basesessionmodel#method-getdisplaytypedefault)

**Actions:** [setSelection](../basesessionmodel#action-setselection),
[clearSelection](../basesessionmodel#action-clearselection),
[setHovered](../basesessionmodel#action-sethovered),
[setPreferenceOverride](../basesessionmodel#action-setpreferenceoverride),
[setScrollZoom](../basesessionmodel#action-setscrollzoom),
[setDisplayTypeDefault](../basesessionmodel#action-setdisplaytypedefault),
[setName](../basesessionmodel#action-setname),
[setFocusedViewId](../basesessionmodel#action-setfocusedviewid),
[removeActiveDialog](../basesessionmodel#action-removeactivedialog),
[queueDialog](../basesessionmodel#action-queuedialog)

### Available via [SnackbarModel](../snackbarmodel)

**Volatiles:** [snackbarMessages](../snackbarmodel#volatile-snackbarmessages),
[errorDialog](../snackbarmodel#volatile-errordialog)

**Getters:** [snackbarMessageSet](../snackbarmodel#getter-snackbarmessageset)

**Actions:** [notify](../snackbarmodel#action-notify),
[notifyError](../snackbarmodel#action-notifyerror),
[setErrorDialog](../snackbarmodel#action-seterrordialog),
[pushSnackbarMessage](../snackbarmodel#action-pushsnackbarmessage),
[popSnackbarMessage](../snackbarmodel#action-popsnackbarmessage),
[removeSnackbarMessage](../snackbarmodel#action-removesnackbarmessage)

### Available via [ReferenceManagementSessionMixin](../referencemanagementsessionmixin)

**Methods:**
[getReferringMultiple](../referencemanagementsessionmixin#method-getreferringmultiple),
[getReferring](../referencemanagementsessionmixin#method-getreferring)

**Actions:**
[dereferenceTrack](../referencemanagementsessionmixin#action-dereferencetrack)

<details>
<summary>SessionTracksManagerSessionMixin - Properties</summary>

#### property: sessionTracks

User-added session tracks (no matching admin config track). A non-admin's
_edits_ to an existing config track are stored as deltas (trackConfigDeltas),
not here.

```ts
// type signature
type sessionTracks = IOptionalIType<IArrayType<IAnyModelType>, [undefined]>
// code
sessionTracks: types.stripDefault(
  types.array(pluginManager.pluggableConfigSchemaType('track')),
  [],
)
```

#### property: trackConfigDeltas

Per-track config overrides for a non-admin, keyed by trackId, stored as a
_delta_ against the admin-owned base config (jbrowse.tracks entry) rather than a
full copy — so a later admin change to an untouched field still flows through
(see trackConfigDelta.ts). Frozen (not a typed track array) on purpose: a typed
create() would fill defaults, erasing the "unset vs default" distinction the
delta merge relies on.

```ts
// type signature
type trackConfigDeltas = IType<
  Record<string, PlainTrackConfig> | null | undefined,
  Record<string, PlainTrackConfig>,
  Record<string, PlainTrackConfig>
>
// code
trackConfigDeltas: types.frozen<Record<string, PlainTrackConfig>>({})
```

</details>

<details>
<summary>SessionTracksManagerSessionMixin - Volatiles</summary>

#### volatile: editableTrackConfigs

Per-track private working copies (non-admin), keyed by trackId. A plain Map —
not observable, not persisted — mirroring the pluginManager hydration cache: it
holds the live MST config node a shown track's in-place quick-edits mutate, so
the shared frozen base is never touched. See agent-docs/ADR-032.

Not evicted: it's a pure memoization cache, bounded by the count of distinct
tracks shown this session (each entry a lazily-hydrated config node), holding no
authoritative state — the persisted delta is the source of truth, and
reset/programmatic edits keep a retained copy in sync. Retention is volatile RAM
only (never serialized), so it's not worth a reference-counted prune at every
track-removal path.

```ts
// type signature
type editableTrackConfigs = Map<string, IAnyStateTreeNode>
// code
editableTrackConfigs: new Map<string, IAnyStateTreeNode>()
```

</details>

<details>
<summary>SessionTracksManagerSessionMixin - Getters</summary>

#### getter: tracks

User-added session tracks first, then each admin config track with its delta
(trackConfigDeltas) merged over it. A base track without a delta is returned
unchanged by identity to keep the hydration cache warm.

```ts
type tracks = (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]
```

</details>

<details>
<summary>SessionTracksManagerSessionMixin - Methods</summary>

#### method: getTrackConfigChanges

The overridden slots for `trackId` (empty when it has no delta): each changed
setting's path, its base/default value and the edited value. Drives the "view
changes" dialog opened from the edited badge.

```ts
type getTrackConfigChanges = (trackId: string) => TrackConfigChange[]
```

#### method: getEditableTrackConfig

A non-admin's private working copy of a track config, created on first access
from the current frozen (base+delta) value and cached by trackId, so a shown
track's in-place quick-edits (setSlot) mutate this copy and never the shared
frozen base node (see ADR-032). Undefined in admin mode — there the base
jbrowse.tracks entry is edited in place. Called by TrackConfigurationReference
during lazy hydration.

```ts
type getEditableTrackConfig = (
  trackId: string,
  frozenConfig: unknown,
  schemaType: IAnyType,
) => IAnyStateTreeNode | undefined
```

</details>

<details>
<summary>SessionTracksManagerSessionMixin - Actions</summary>

#### action: updateTrackConfiguration

Persist an edited track config. Admins edit the jbrowse config in place;
everyone else gets a delta (trackConfigDeltas) against the admin-owned base —
only the changed slots — so the edits persist and are shared while admin changes
to untouched fields still flow through. A user-added session track (no base)
keeps living in sessionTracks.

```ts
type updateTrackConfiguration = (trackConf: PlainTrackConfig) => void
```

#### action: resetTrackConfiguration

Drop a non-admin's delta (trackConfigDeltas) so the track reverts to its admin
config (jbrowse.tracks) default. Unlike deleteTrackConf this does not
dereference the track from open views — the base config re-resolves in place, so
an open track stays open and simply reverts.

```ts
type resetTrackConfiguration = (trackId: string) => void
```

</details>

<details>
<summary>SessionTracksManagerSessionMixin - Actions (other undocumented members)</summary>

#### action: addTrackConf

```ts
type addTrackConf = (trackConf: AnyConfiguration) => any
```

#### action: deleteTrackConf

```ts
type deleteTrackConf = (trackConf: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => any[] | undefined
```

</details>
