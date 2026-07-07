---
id: basewebsessionmodel
title: BaseWebSessionModel
sidebar_label: Session -> BaseWebSessionModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/web-core/src/BaseWebSession/index.ts).

## Overview

Composable web session shared by jbrowse-web and react-app, before (the
snapshotProcessor can't be `compose`d). jbrowse-web composes
`WebSessionManagementMixin` onto this; react-app uses it as-is.

## Members

| Member                                                     | Kind       | Description                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [sessionPlugins](#property-sessionplugins)                 | Properties |                                                                                                                                                                                                                                                                                 |
| [sessionThemeName](#volatile-sessionthemename)             | Volatiles  |                                                                                                                                                                                                                                                                                 |
| [pendingFileHandleIds](#volatile-pendingfilehandleids)     | Volatiles  |                                                                                                                                                                                                                                                                                 |
| [root](#getter-root)                                       | Getters    |                                                                                                                                                                                                                                                                                 |
| [connections](#getter-connections)                         | Getters    | list of config connections and session connections                                                                                                                                                                                                                              |
| [shareURL](#getter-shareurl)                               | Getters    |                                                                                                                                                                                                                                                                                 |
| [textSearchManager](#getter-textsearchmanager)             | Getters    |                                                                                                                                                                                                                                                                                 |
| [canEditTrack](#method-canedittrack)                       | Methods    | whether the user may edit this track's config (admins may edit any; everyone else only their own session tracks)                                                                                                                                                                |
| [isTrackOverride](#method-istrackoverride)                 | Methods    | whether `trackId` has a non-admin config override (a delta stored in trackConfigDeltas against an admin-owned config track, see updateTrackConfiguration), rather than a standalone user-added session track. Drives the "Reset track settings" menu swap and the edited badge. |
| [getTrackActions](#method-gettrackactions)                 | Methods    | raw track actions (Settings, Copy, Delete) without submenu wrapper                                                                                                                                                                                                              |
| [addAssemblyConf](#action-addassemblyconf)                 | Actions    |                                                                                                                                                                                                                                                                                 |
| [addSessionPlugin](#action-addsessionplugin)               | Actions    |                                                                                                                                                                                                                                                                                 |
| [removeSessionPlugin](#action-removesessionplugin)         | Actions    |                                                                                                                                                                                                                                                                                 |
| [setDefaultSession](#action-setdefaultsession)             | Actions    |                                                                                                                                                                                                                                                                                 |
| [setSession](#action-setsession)                           | Actions    |                                                                                                                                                                                                                                                                                 |
| [editTrackConfiguration](#action-edittrackconfiguration)   | Actions    | opens the config editor for a track. Available for any track: edits to a non-session (admin-owned) track apply in-memory for the current session even when the user lacks rights to persist them.                                                                               |
| [setPendingFileHandleIds](#action-setpendingfilehandleids) | Actions    |                                                                                                                                                                                                                                                                                 |

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [ReferenceManagementSessionMixin](../referencemanagementsessionmixin)

**Methods:**
[getReferringMultiple](../referencemanagementsessionmixin#method-getreferringmultiple),
[getReferring](../referencemanagementsessionmixin#method-getreferring)

**Actions:**
[dereferenceTrack](../referencemanagementsessionmixin#action-dereferencetrack)

### Available via [ThemeManagerSessionMixin](../thememanagersessionmixin)

**Volatiles:**
[sessionThemeName](../thememanagersessionmixin#volatile-sessionthemename)

**Getters:** [themeName](../thememanagersessionmixin#getter-themename),
[themeOptions](../thememanagersessionmixin#getter-themeoptions),
[theme](../thememanagersessionmixin#getter-theme)

**Methods:** [allThemes](../thememanagersessionmixin#method-allthemes),
[getActiveThemeOptions](../thememanagersessionmixin#method-getactivethemeoptions)

**Actions:** [setThemeName](../thememanagersessionmixin#action-setthemename)

### Available via [MultipleViewsSessionMixin](../multipleviewssessionmixin)

**Properties:** [views](../multipleviewssessionmixin#property-views),
[stickyViewHeaders](../multipleviewssessionmixin#property-stickyviewheaders),
[useWorkspaces](../multipleviewssessionmixin#property-useworkspaces)

**Actions:** [moveViewDown](../multipleviewssessionmixin#action-moveviewdown),
[moveViewUp](../multipleviewssessionmixin#action-moveviewup),
[moveViewToTop](../multipleviewssessionmixin#action-moveviewtotop),
[moveViewToBottom](../multipleviewssessionmixin#action-moveviewtobottom),
[addView](../multipleviewssessionmixin#action-addview),
[removeView](../multipleviewssessionmixin#action-removeview),
[setStickyViewHeaders](../multipleviewssessionmixin#action-setstickyviewheaders),
[setUseWorkspaces](../multipleviewssessionmixin#action-setuseworkspaces)

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

### Available via [SessionTracksManagerSessionMixin](../sessiontracksmanagersessionmixin)

**Properties:**
[sessionTracks](../sessiontracksmanagersessionmixin#property-sessiontracks),
[trackConfigDeltas](../sessiontracksmanagersessionmixin#property-trackconfigdeltas)

**Volatiles:**
[editableTrackConfigs](../sessiontracksmanagersessionmixin#volatile-editabletrackconfigs)

**Getters:** [tracks](../sessiontracksmanagersessionmixin#getter-tracks)

**Methods:**
[getTrackConfigChanges](../sessiontracksmanagersessionmixin#method-gettrackconfigchanges),
[getEditableTrackConfig](../sessiontracksmanagersessionmixin#method-geteditabletrackconfig)

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

### Available via [AssembliesMixin](../assembliesmixin)

**Properties:**
[sessionAssemblies](../assembliesmixin#property-sessionassemblies),
[temporaryAssemblies](../assembliesmixin#property-temporaryassemblies)

**Getters:** [assemblies](../assembliesmixin#getter-assemblies),
[assemblyNames](../assembliesmixin#getter-assemblynames)

**Actions:** [addSessionAssembly](../assembliesmixin#action-addsessionassembly),
[addAssembly](../assembliesmixin#action-addassembly),
[removeAssembly](../assembliesmixin#action-removeassembly),
[removeSessionAssembly](../assembliesmixin#action-removesessionassembly),
[addTemporaryAssembly](../assembliesmixin#action-addtemporaryassembly),
[removeTemporaryAssembly](../assembliesmixin#action-removetemporaryassembly)

### Available via [AppSessionMixin](../appsessionmixin)

**Getters:** [root](../appsessionmixin#getter-root),
[version](../appsessionmixin#getter-version),
[gitCommit](../appsessionmixin#getter-gitcommit),
[history](../appsessionmixin#getter-history),
[assemblyManager](../appsessionmixin#getter-assemblymanager)

**Methods:** [menus](../appsessionmixin#method-menus)

**Actions:**
[renameCurrentSession](../appsessionmixin#action-renamecurrentsession)

### Available via [WebSessionConnectionsMixin](../websessionconnectionsmixin)

**Properties:**
[sessionConnections](../websessionconnectionsmixin#property-sessionconnections)

**Actions:**
[addConnectionConf](../websessionconnectionsmixin#action-addconnectionconf),
[deleteConnection](../websessionconnectionsmixin#action-deleteconnection)

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

### Available via [DockviewLayoutMixin](../dockviewlayoutmixin)

**Properties:**
[dockviewLayout](../dockviewlayoutmixin#property-dockviewlayout),
[panelViewAssignments](../dockviewlayoutmixin#property-panelviewassignments),
[activePanelId](../dockviewlayoutmixin#property-activepanelid),
[init](../dockviewlayoutmixin#property-init)

**Volatiles:** [pendingMove](../dockviewlayoutmixin#volatile-pendingmove)

**Getters:**
[getViewIdsForPanel](../dockviewlayoutmixin#getter-getviewidsforpanel),
[getPanelContainingView](../dockviewlayoutmixin#getter-getpanelcontainingview)

**Actions:**
[setDockviewLayout](../dockviewlayoutmixin#action-setdockviewlayout),
[setActivePanelId](../dockviewlayoutmixin#action-setactivepanelid),
[setInit](../dockviewlayoutmixin#action-setinit),
[setPendingMove](../dockviewlayoutmixin#action-setpendingmove),
[assignViewToPanel](../dockviewlayoutmixin#action-assignviewtopanel),
[removeViewFromPanel](../dockviewlayoutmixin#action-removeviewfrompanel),
[removePanel](../dockviewlayoutmixin#action-removepanel),
[moveViewUpInPanel](../dockviewlayoutmixin#action-moveviewupinpanel),
[moveViewDownInPanel](../dockviewlayoutmixin#action-moveviewdowninpanel),
[moveViewToTopInPanel](../dockviewlayoutmixin#action-moveviewtotopinpanel),
[moveViewToBottomInPanel](../dockviewlayoutmixin#action-moveviewtobottominpanel)

### Available via [TrackMenuItemsSessionMixin](../trackmenuitemssessionmixin)

**Methods:**
[getTrackListMenuItems](../trackmenuitemssessionmixin#method-gettracklistmenuitems),
[getTrackActionMenuItems](../trackmenuitemssessionmixin#method-gettrackactionmenuitems)

<details>
<summary>BaseWebSessionModel - Properties</summary>

#### property: sessionPlugins

```ts
// type signature
type sessionPlugins = IArrayType<
  IType<
    PluginDefinition & { name: string },
    PluginDefinition & { name: string },
    PluginDefinition & { name: string }
  >
>
// code
sessionPlugins: types.array(types.frozen<PluginDefinition & { name: string }>())
```

</details>

<details>
<summary>BaseWebSessionModel - Volatiles</summary>

#### volatile: sessionThemeName

```ts
// type signature
type sessionThemeName = string
// code
sessionThemeName: localStorageGetItem('themeName') ?? 'default'
```

#### volatile: pendingFileHandleIds

```ts
// type signature
type pendingFileHandleIds = string[]
// code
pendingFileHandleIds: [] as string[]
```

</details>

<details>
<summary>BaseWebSessionModel - Getters</summary>

#### getter: connections

list of config connections and session connections

```ts
type connections = (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]
```

</details>

<details>
<summary>BaseWebSessionModel - Getters (other undocumented members)</summary>

#### getter: root

```ts
type root = AbstractWebRootModel
```

#### getter: shareURL

```ts
type shareURL = any
```

#### getter: textSearchManager

```ts
type textSearchManager = TextSearchManager
```

</details>

<details>
<summary>BaseWebSessionModel - Methods</summary>

#### method: canEditTrack

whether the user may edit this track's config (admins may edit any; everyone
else only their own session tracks)

```ts
type canEditTrack = (trackId: string) => boolean
```

#### method: isTrackOverride

whether `trackId` has a non-admin config override (a delta stored in
trackConfigDeltas against an admin-owned config track, see
updateTrackConfiguration), rather than a standalone user-added session track.
Drives the "Reset track settings" menu swap and the edited badge.

```ts
type isTrackOverride = (trackId: string) => boolean
```

#### method: getTrackActions

raw track actions (Settings, Copy, Delete) without submenu wrapper

```ts
type getTrackActions = (config: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>, view?: TrackActionView | undefined) => MenuItem[]
```

</details>

<details>
<summary>BaseWebSessionModel - Actions</summary>

#### action: editTrackConfiguration

opens the config editor for a track. Available for any track: edits to a
non-session (admin-owned) track apply in-memory for the current session even
when the user lacks rights to persist them.

```ts
type editTrackConfiguration = (configuration: (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) | { ...; }) => void
```

</details>

<details>
<summary>BaseWebSessionModel - Actions (other undocumented members)</summary>

#### action: addAssemblyConf

```ts
type addAssemblyConf = (conf: AnyConfiguration) => void
```

#### action: addSessionPlugin

```ts
type addSessionPlugin = (plugin: PluginDefinition & { name: string }) => void
```

#### action: removeSessionPlugin

```ts
type removeSessionPlugin = (pluginDefinition: PluginDefinition) => void
```

#### action: setDefaultSession

```ts
type setDefaultSession = () => void
```

#### action: setSession

```ts
type setSession = (sessionSnapshot: ModelCreationType<ExtractCFromProps<_OverrideProps<_OverrideProps<_OverrideProps<Omit<_OverrideProps<_OverrideProps<_OverrideProps<_OverrideProps<Omit<{}, never>, _OverrideProps<_OverrideProps<Omit<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; name: ISimpleType<string>; margin: IOptionalI...
```

#### action: setPendingFileHandleIds

```ts
type setPendingFileHandleIds = (ids: string[]) => void
```

</details>
