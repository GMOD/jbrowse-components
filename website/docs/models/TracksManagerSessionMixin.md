---
id: tracksmanagersessionmixin
title: TracksManagerSessionMixin
sidebar_label: Mixin -> TracksManagerSessionMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/Tracks.ts).

## Overview

## Members

| Member                                                       | Kind    | Description                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [tracks](#getter-tracks)                                     | Getters |                                                                                                                                                                                                                                                                      |
| [getTracksById](#getter-gettracksbyid)                       | Getters | Map of trackId → config for all tracks, assemblies, and connections. Frozen jbrowse.tracks are returned as plain objects here; hydration to MST models happens lazily in TrackConfigurationReference on first access. MobX caches this until any dependency changes. |
| [tracksById](#getter-tracksbyid)                             | Getters | MobX-cached map of trackId → config for all tracks, assemblies, and connections. Recomputes only when dependencies change.                                                                                                                                           |
| [addTrackConf](#action-addtrackconf)                         | Actions |                                                                                                                                                                                                                                                                      |
| [updateTrackConfiguration](#action-updatetrackconfiguration) | Actions | Persist edited track config back to the in-memory jbrowse config. The session-tracks mixin overrides this so a non-admin's edits become a shareable session-track override instead.                                                                                  |
| [deleteTrackConf](#action-deletetrackconf)                   | Actions |                                                                                                                                                                                                                                                                      |

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseSessionModel](../basesessionmodel)

**Properties:** [id](../basesessionmodel#property-id),
[name](../basesessionmodel#property-name),
[margin](../basesessionmodel#property-margin),
[focusedViewId](../basesessionmodel#property-focusedviewid),
[highlightsVisible](../basesessionmodel#property-highlightsvisible)

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
[setHighlightsVisible](../basesessionmodel#action-sethighlightsvisible),
[setPreferenceOverride](../basesessionmodel#action-setpreferenceoverride),
[clearPreferenceOverrides](../basesessionmodel#action-clearpreferenceoverrides),
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
<summary>TracksManagerSessionMixin - Getters</summary>

#### getter: getTracksById

Map of trackId → config for all tracks, assemblies, and connections. Frozen
jbrowse.tracks are returned as plain objects here; hydration to MST models
happens lazily in TrackConfigurationReference on first access. MobX caches this
until any dependency changes.

```ts
type getTracksById = () => Record<string, ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>>
```

#### getter: tracksById

MobX-cached map of trackId → config for all tracks, assemblies, and connections.
Recomputes only when dependencies change.

```ts
type tracksById = Record<string, ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>>
```

</details>

<details>
<summary>TracksManagerSessionMixin - Getters (other undocumented members)</summary>

#### getter: tracks

```ts
type tracks = (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]
```

</details>

<details>
<summary>TracksManagerSessionMixin - Actions</summary>

#### action: updateTrackConfiguration

Persist edited track config back to the in-memory jbrowse config. The
session-tracks mixin overrides this so a non-admin's edits become a shareable
session-track override instead.

```ts
type updateTrackConfiguration = (trackConf: {
  [key: string]: unknown
  trackId: string
}) => void
```

</details>

<details>
<summary>TracksManagerSessionMixin - Actions (other undocumented members)</summary>

#### action: addTrackConf

```ts
type addTrackConf = (trackConf: AnyConfiguration) => any
```

#### action: deleteTrackConf

```ts
type deleteTrackConf = (trackConf: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => any
```

</details>
