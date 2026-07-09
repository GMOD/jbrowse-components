---
id: jbrowsereactcirculargenomeviewsessionmodel
title: JBrowseReactCircularGenomeViewSessionModel
sidebar_label: Session -> JBrowseReactCircularGenomeViewSessionModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-circular-genome-view/src/createModel/createSessionModel.ts).

## Overview

## Members

| Member                                     | Kind       | Description                |
| ------------------------------------------ | ---------- | -------------------------- |
| [view](#property-view)                     | Properties |                            |
| [version](#getter-version)                 | Getters    |                            |
| [assemblyNames](#getter-assemblynames)     | Getters    |                            |
| [assemblyManager](#getter-assemblymanager) | Getters    |                            |
| [views](#getter-views)                     | Getters    |                            |
| [addView](#action-addview)                 | Actions    | replaces view in this case |
| [removeView](#action-removeview)           | Actions    | does nothing               |

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
[connectionInstances](../connectionmanagementsessionmixin#property-connectioninstances),
[connectionTrackConfigs](../connectionmanagementsessionmixin#property-connectiontrackconfigs)

**Getters:**
[connections](../connectionmanagementsessionmixin#getter-connections)

**Actions:**
[makeConnection](../connectionmanagementsessionmixin#action-makeconnection),
[breakConnection](../connectionmanagementsessionmixin#action-breakconnection),
[teardownConnection](../connectionmanagementsessionmixin#action-teardownconnection),
[deleteConnection](../connectionmanagementsessionmixin#action-deleteconnection),
[addConnectionConf](../connectionmanagementsessionmixin#action-addconnectionconf),
[clearConnections](../connectionmanagementsessionmixin#action-clearconnections),
[captureConnectionTrack](../connectionmanagementsessionmixin#action-captureconnectiontrack),
[updateConnectionTrackConfig](../connectionmanagementsessionmixin#action-updateconnectiontrackconfig),
[setConnectionTrackConfig](../connectionmanagementsessionmixin#action-setconnectiontrackconfig),
[pruneConnectionTrackConfig](../connectionmanagementsessionmixin#action-pruneconnectiontrackconfig),
[hydrateConnection](../connectionmanagementsessionmixin#action-hydrateconnection)

### Available via [TracksManagerSessionMixin](../tracksmanagersessionmixin)

**Getters:** [tracks](../tracksmanagersessionmixin#getter-tracks),
[getTracksById](../tracksmanagersessionmixin#getter-gettracksbyid),
[tracksById](../tracksmanagersessionmixin#getter-tracksbyid)

**Actions:** [addTrackConf](../tracksmanagersessionmixin#action-addtrackconf),
[updateTrackConfiguration](../tracksmanagersessionmixin#action-updatetrackconfiguration),
[deleteTrackConf](../tracksmanagersessionmixin#action-deletetrackconf)

### Available via [ReferenceManagementSessionMixin](../referencemanagementsessionmixin)

**Methods:**
[getReferringMultiple](../referencemanagementsessionmixin#method-getreferringmultiple),
[getReferring](../referencemanagementsessionmixin#method-getreferring)

**Actions:**
[dereferenceTrack](../referencemanagementsessionmixin#action-dereferencetrack)

### Available via [TrackMenuSessionMixin](../trackmenusessionmixin)

**Methods:**
[getTrackListMenuItems](../trackmenusessionmixin#method-gettracklistmenuitems),
[getTrackActionMenuItems](../trackmenusessionmixin#method-gettrackactionmenuitems)

### Available via [EmbeddedSessionThemeMixin](../embeddedsessionthememixin)

**Getters:** [themeOptions](../embeddedsessionthememixin#getter-themeoptions),
[theme](../embeddedsessionthememixin#getter-theme)

<details>
<summary>JBrowseReactCircularGenomeViewSessionModel - Properties</summary>

#### property: view

```ts
// type signature
type view = IModelType<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IOptionalIType<ISimpleType<boolean>, [...]>; }, { ...; }>, { ...; } & ... 8 more ... & { ...; }, _NotCustomized, ModelSnapshotType<...>>
// code
view: pluginManager.getViewType('CircularView')!
        .stateModel as CircularViewStateModel
```

</details>

<details>
<summary>JBrowseReactCircularGenomeViewSessionModel - Getters</summary>

#### getter: version

```ts
type version = string
```

#### getter: assemblyNames

```ts
type assemblyNames = string[]
```

#### getter: assemblyManager

```ts
type assemblyManager = ModelInstanceTypeProps<{ assemblies: IArrayType<IModelType<{ configuration: IMaybe<IReferenceType<IAnyType>>; }, { error: unknown; loadingP: Promise<void> | undefined; adapterLoads: QuickLRU<...>; ... 6 more ...; allRefNamesWithLowerCase: Set<...> | undefined; } & ... 11 more ... & { ...; }, _NotCustomized, _NotCust...
```

#### getter: views

```ts
type views = (ModelInstanceTypeProps<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IOptionalIType<ISimpleType<boolean>, [...]>; }, { ...; }>> & ... 10 more ... & IStateTreeNode<...>)[]
```

</details>

<details>
<summary>JBrowseReactCircularGenomeViewSessionModel - Actions</summary>

#### action: addView

replaces view in this case

```ts
type addView = (typeName: string, initialState?: any) => ModelInstanceTypeProps<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IOptionalIType<...>; }, { ...; }>> & ... 10 more ... & IStateTreeNode<...>
```

#### action: removeView

does nothing

```ts
type removeView = () => void
```

</details>
