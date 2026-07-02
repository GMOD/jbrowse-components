---
id: tracksmanagersessionmixin
title: TracksManagerSessionMixin
sidebar_label: Mixin -> TracksManagerSessionMixin
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

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

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
[getReferring](../referencemanagementsessionmixin#method-getreferring),
[getReferringMultiple](../referencemanagementsessionmixin#method-getreferringmultiple)

**Actions:**
[removeReferring](../referencemanagementsessionmixin#action-removereferring)

<details open>
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

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                     | Signature                                                                                                                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`tracks`](#getter-tracks) | `(ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]` |

</details>

<details>
<summary>TracksManagerSessionMixin - Getters (all signatures)</summary>

#### getter: tracks

```ts
type tracks = (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]
```

</details>

<details open>
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

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                       | Signature                                                                                                                                                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`addTrackConf`](#action-addtrackconf)       | `(trackConf: AnyConfiguration) => any`                                                                                                                                                                             |
| [`deleteTrackConf`](#action-deletetrackconf) | `(trackConf: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => any` |

</details>

<details>
<summary>TracksManagerSessionMixin - Actions (all signatures)</summary>

#### action: addTrackConf

```ts
type addTrackConf = (trackConf: AnyConfiguration) => any
```

#### action: deleteTrackConf

```ts
type deleteTrackConf = (trackConf: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => any
```

</details>
