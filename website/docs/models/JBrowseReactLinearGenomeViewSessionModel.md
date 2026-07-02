---
id: jbrowsereactlineargenomeviewsessionmodel
title: JBrowseReactLinearGenomeViewSessionModel
sidebar_label: Session -> JBrowseReactLinearGenomeViewSessionModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/src/createModel/createSessionModel.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/JBrowseReactLinearGenomeViewSessionModel.md)

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

**Methods:** [getPreference](../basesessionmodel#method-getpreference)

**Actions:** [setSelection](../basesessionmodel#action-setselection),
[clearSelection](../basesessionmodel#action-clearselection),
[setHovered](../basesessionmodel#action-sethovered),
[setPreferenceOverride](../basesessionmodel#action-setpreferenceoverride),
[setScrollZoom](../basesessionmodel#action-setscrollzoom),
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

### Available via [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)

**Properties:**
[drawerPosition](../drawerwidgetsessionmixin#property-drawerposition),
[drawerWidth](../drawerwidgetsessionmixin#property-drawerwidth),
[widgets](../drawerwidgetsessionmixin#property-widgets),
[activeWidgets](../drawerwidgetsessionmixin#property-activewidgets),
[minimized](../drawerwidgetsessionmixin#property-minimized)

**Getters:** [visibleWidget](../drawerwidgetsessionmixin#getter-visiblewidget)

**Actions:**
[setDrawerPosition](../drawerwidgetsessionmixin#action-setdrawerposition),
[updateDrawerWidth](../drawerwidgetsessionmixin#action-updatedrawerwidth),
[resizeDrawer](../drawerwidgetsessionmixin#action-resizedrawer),
[addWidget](../drawerwidgetsessionmixin#action-addwidget),
[showWidget](../drawerwidgetsessionmixin#action-showwidget),
[hideWidget](../drawerwidgetsessionmixin#action-hidewidget),
[minimizeWidgetDrawer](../drawerwidgetsessionmixin#action-minimizewidgetdrawer),
[showWidgetDrawer](../drawerwidgetsessionmixin#action-showwidgetdrawer),
[hideAllWidgets](../drawerwidgetsessionmixin#action-hideallwidgets),
[editConfiguration](../drawerwidgetsessionmixin#action-editconfiguration)

### Available via [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin)

**Properties:**
[connectionInstances](../connectionmanagementsessionmixin#property-connectioninstances)

**Getters:**
[connections](../connectionmanagementsessionmixin#getter-connections)

**Actions:**
[makeConnection](../connectionmanagementsessionmixin#action-makeconnection),
[prepareToBreakConnection](../connectionmanagementsessionmixin#action-preparetobreakconnection),
[breakConnection](../connectionmanagementsessionmixin#action-breakconnection),
[deleteConnection](../connectionmanagementsessionmixin#action-deleteconnection),
[addConnectionConf](../connectionmanagementsessionmixin#action-addconnectionconf),
[clearConnections](../connectionmanagementsessionmixin#action-clearconnections)

### Available via [ReferenceManagementSessionMixin](../referencemanagementsessionmixin)

**Methods:**
[getReferring](../referencemanagementsessionmixin#method-getreferring),
[getReferringMultiple](../referencemanagementsessionmixin#method-getreferringmultiple)

**Actions:**
[removeReferring](../referencemanagementsessionmixin#action-removereferring)

### Available via [SessionTracksManagerSessionMixin](../sessiontracksmanagersessionmixin)

**Properties:**
[sessionTracks](../sessiontracksmanagersessionmixin#property-sessiontracks),
[trackConfigDeltas](../sessiontracksmanagersessionmixin#property-trackconfigdeltas)

**Getters:** [tracks](../sessiontracksmanagersessionmixin#getter-tracks)

**Actions:**
[addTrackConf](../sessiontracksmanagersessionmixin#action-addtrackconf),
[updateTrackConfiguration](../sessiontracksmanagersessionmixin#action-updatetrackconfiguration),
[resetTrackConfiguration](../sessiontracksmanagersessionmixin#action-resettrackconfiguration),
[deleteTrackConf](../sessiontracksmanagersessionmixin#action-deletetrackconf)

### Available via [TracksManagerSessionMixin](../tracksmanagersessionmixin)

**Getters:** [tracks](../tracksmanagersessionmixin#getter-tracks),
[getTracksById](../tracksmanagersessionmixin#getter-gettracksbyid),
[tracksById](../tracksmanagersessionmixin#getter-tracksbyid)

**Actions:** [addTrackConf](../tracksmanagersessionmixin#action-addtrackconf),
[updateTrackConfiguration](../tracksmanagersessionmixin#action-updatetrackconfiguration),
[deleteTrackConf](../tracksmanagersessionmixin#action-deletetrackconf)

### Available via [TrackMenuSessionMixin](../trackmenusessionmixin)

**Methods:**
[getTrackListMenuItems](../trackmenusessionmixin#method-gettracklistmenuitems),
[getTrackActionMenuItems](../trackmenusessionmixin#method-gettrackactionmenuitems)

<details open>
<summary>JBrowseReactLinearGenomeViewSessionModel - Properties</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                   | Signature                                                                                                                                                                                                                                                            |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`view`](#property-view) | `IModelType<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IOptionalIType<ISimpleType<boolean>, [...]>; }, { ...; }>, { ...; } & ... 17 more ... & { ...; }, _NotCustomized, { ...; }>` |

</details>

<details>
<summary>JBrowseReactLinearGenomeViewSessionModel - Properties (all signatures)</summary>

#### property: view

```ts
// type signature
type view = IModelType<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IOptionalIType<ISimpleType<boolean>, [...]>; }, { ...; }>, { ...; } & ... 17 more ... & { ...; }, _NotCustomized, { ...; }>
// code
view: pluginManager.getViewType('LinearGenomeView')!
        .stateModel as LinearGenomeViewStateModel
```

</details>

<details open>
<summary>JBrowseReactLinearGenomeViewSessionModel - Getters</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                         | Signature                                                                                                                                                                                                                                                   |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`version`](#getter-version)                   | `any`                                                                                                                                                                                                                                                       |
| [`disableAddTracks`](#getter-disableaddtracks) | `any`                                                                                                                                                                                                                                                       |
| [`assemblies`](#getter-assemblies)             | `any[]`                                                                                                                                                                                                                                                     |
| [`assemblyNames`](#getter-assemblynames)       | `any[]`                                                                                                                                                                                                                                                     |
| [`connections`](#getter-connections)           | `any`                                                                                                                                                                                                                                                       |
| [`assemblyManager`](#getter-assemblymanager)   | `any`                                                                                                                                                                                                                                                       |
| [`views`](#getter-views)                       | `(ModelInstanceTypeProps<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IOptionalIType<ISimpleType<boolean>, [...]>; }, { ...; }>> & ... 19 more ... & IStateTreeNode<...>)[]` |
| [`theme`](#getter-theme)                       | `Theme`                                                                                                                                                                                                                                                     |

</details>

<details>
<summary>JBrowseReactLinearGenomeViewSessionModel - Getters (all signatures)</summary>

#### getter: version

```ts
type version = any
```

#### getter: disableAddTracks

```ts
type disableAddTracks = any
```

#### getter: assemblies

```ts
type assemblies = any[]
```

#### getter: assemblyNames

```ts
type assemblyNames = any[]
```

#### getter: connections

```ts
type connections = any
```

#### getter: assemblyManager

```ts
type assemblyManager = any
```

#### getter: views

```ts
type views = (ModelInstanceTypeProps<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IOptionalIType<ISimpleType<boolean>, [...]>; }, { ...; }>> & ... 19 more ... & IStateTreeNode<...>)[]
```

#### getter: theme

```ts
type theme = Theme
```

</details>

<details open>
<summary>JBrowseReactLinearGenomeViewSessionModel - Methods</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                               | Signature                                           |
| ------------------------------------ | --------------------------------------------------- |
| [`renderProps`](#method-renderprops) | `() => { theme: any; highResolutionScaling: any; }` |

</details>

<details>
<summary>JBrowseReactLinearGenomeViewSessionModel - Methods (all signatures)</summary>

#### method: renderProps

```ts
type renderProps = () => { theme: any; highResolutionScaling: any }
```

</details>

<details open>
<summary>JBrowseReactLinearGenomeViewSessionModel - Actions</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                             | Signature                                                                                                                                                                                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`addView`](#action-addview)       | `(typeName: string, initialState?: any) => ModelInstanceTypeProps<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IOptionalIType<...>; }, { ...; }>> & ... 19 more ... & IStateTreeNode<...>` |
| [`removeView`](#action-removeview) | `() => void`                                                                                                                                                                                                                                                              |

</details>

<details>
<summary>JBrowseReactLinearGenomeViewSessionModel - Actions (all signatures)</summary>

#### action: addView

```ts
type addView = (typeName: string, initialState?: any) => ModelInstanceTypeProps<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IOptionalIType<...>; }, { ...; }>> & ... 19 more ... & IStateTreeNode<...>
```

#### action: removeView

```ts
type removeView = () => void
```

</details>
