---
id: basewebsessionmodel
title: BaseWebSessionModel
sidebar_label: Session -> BaseWebSessionModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/web-core/src/BaseWebSession/index.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/BaseWebSessionModel.md)

## Overview

Composable web session shared by jbrowse-web and react-app, before (the
snapshotProcessor can't be `compose`d). jbrowse-web composes
`WebSessionManagementMixin` onto this; react-app uses it as-is.

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [ReferenceManagementSessionMixin](../referencemanagementsessionmixin)

**Methods:**
[getReferring](../referencemanagementsessionmixin#method-getreferring),
[getReferringMultiple](../referencemanagementsessionmixin#method-getreferringmultiple)

**Actions:**
[removeReferring](../referencemanagementsessionmixin#action-removereferring)

### Available via [ThemeManagerSessionMixin](../thememanagersessionmixin)

**Volatiles:**
[sessionThemeName](../thememanagersessionmixin#volatile-sessionthemename)

**Getters:** [themeName](../thememanagersessionmixin#getter-themename),
[themeOptions](../thememanagersessionmixin#getter-themeoptions),
[theme](../thememanagersessionmixin#getter-theme)

**Methods:** [allThemes](../thememanagersessionmixin#method-allthemes)

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
[queueOfDialogs](../basesessionmodel#volatile-queueofdialogs)

**Getters:** [root](../basesessionmodel#getter-root),
[jbrowse](../basesessionmodel#getter-jbrowse),
[rpcManager](../basesessionmodel#getter-rpcmanager),
[configuration](../basesessionmodel#getter-configuration),
[adminMode](../basesessionmodel#getter-adminmode),
[textSearchManager](../basesessionmodel#getter-textsearchmanager),
[assemblies](../basesessionmodel#getter-assemblies),
[DialogComponent](../basesessionmodel#getter-dialogcomponent),
[DialogProps](../basesessionmodel#getter-dialogprops)

**Actions:** [setSelection](../basesessionmodel#action-setselection),
[clearSelection](../basesessionmodel#action-clearselection),
[setHovered](../basesessionmodel#action-sethovered),
[setName](../basesessionmodel#action-setname),
[setFocusedViewId](../basesessionmodel#action-setfocusedviewid),
[removeActiveDialog](../basesessionmodel#action-removeactivedialog),
[queueDialog](../basesessionmodel#action-queuedialog)

### Available via [SnackbarModel](../snackbarmodel)

**Volatiles:** [snackbarMessages](../snackbarmodel#volatile-snackbarmessages)

**Getters:** [snackbarMessageSet](../snackbarmodel#getter-snackbarmessageset)

**Actions:** [notify](../snackbarmodel#action-notify),
[notifyError](../snackbarmodel#action-notifyerror),
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
[sessionTracks](../sessiontracksmanagersessionmixin#property-sessiontracks)

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

**Methods:** [renderProps](../appsessionmixin#method-renderprops),
[menus](../appsessionmixin#method-menus)

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

### Available via [DockviewLayoutMixin](../dockviewlayoutmixin)

**Properties:**
[dockviewLayout](../dockviewlayoutmixin#property-dockviewlayout),
[panelViewAssignments](../dockviewlayoutmixin#property-panelviewassignments),
[init](../dockviewlayoutmixin#property-init),
[pendingMove](../dockviewlayoutmixin#property-pendingmove),
[activePanelId](../dockviewlayoutmixin#property-activepanelid)

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

<details open>
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">BaseWebSessionModel - Properties</summary>

#### property: sessionPlugins

```js
// type signature
IArrayType<IType<PluginDefinition & { name: string; }, PluginDefinition & { name: string; }, PluginDefinition & { name: string; }>>
// code
sessionPlugins: types.array(
        types.frozen<PluginDefinition & { name: string }>(),
      )
```

</details>

<details open>
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">BaseWebSessionModel - Volatiles</summary>

#### volatile: sessionThemeName

```js
// type signature
string
// code
sessionThemeName: localStorageGetItem('themeName') ?? 'default'
```

#### volatile: pendingFileHandleIds

```js
// type signature
string[]
// code
pendingFileHandleIds: [] as string[]
```

</details>

<details open>
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">BaseWebSessionModel - Getters</summary>

#### getter: root

```js
// type
AbstractWebRootModel
```

#### getter: connections

list of config connections and session connections

```js
// type
(ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]
```

#### getter: shareURL

```js
// type
any
```

#### getter: textSearchManager

```js
// type
TextSearchManager
```

</details>

<details open>
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">BaseWebSessionModel - Methods</summary>

#### method: canEditTrack

whether the user may edit this track's config (admins may edit any; everyone
else only their own session tracks)

```js
// type signature
canEditTrack: (trackId: string) => boolean
```

#### method: isTrackOverride

whether `trackId` is a session-track edit (see updateTrackConfiguration)
shadowing an admin-owned config track of the same trackId, rather than a
standalone user-added session track

```js
// type signature
isTrackOverride: (trackId: string) => boolean
```

#### method: getTrackActions

raw track actions (Settings, Copy, Delete) without submenu wrapper

```js
// type signature
getTrackActions: (config: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>, view?: TrackActionView | undefined) => MenuItem[]
```

#### method: getTrackListMenuItems

flattened menu items for use in hierarchical track selector

```js
// type signature
getTrackListMenuItems: (config: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>, view?: TrackActionView | undefined) => MenuItem[]
```

#### method: getTrackActionMenuItems

```js
// type signature
getTrackActionMenuItems: ({ config, effectiveConfig, extraTrackActions, view, }: { config: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>; effectiveConfig: Record<...>; extraTrackActions?: MenuItem[] ...
```

</details>

<details open>
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">BaseWebSessionModel - Actions</summary>

#### action: addAssemblyConf

```js
// type signature
addAssemblyConf: (conf: AnyConfiguration) => void
```

#### action: addSessionPlugin

```js
// type signature
addSessionPlugin: (plugin: PluginDefinition & { name: string; }) => void
```

#### action: removeSessionPlugin

```js
// type signature
removeSessionPlugin: (pluginDefinition: PluginDefinition) => void
```

#### action: setDefaultSession

```js
// type signature
setDefaultSession: () => void
```

#### action: setSession

```js
// type signature
setSession: (sessionSnapshot: ModelCreationType<ExtractCFromProps<_OverrideProps<_OverrideProps<_OverrideProps<Omit<_OverrideProps<_OverrideProps<_OverrideProps<Omit<{}, never>, _OverrideProps<_OverrideProps<Omit<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; name: ISimpleType<string>; margin: IOptionalIType<...>; focu...
```

#### action: editTrackConfiguration

opens the config editor for a track. Available for any track: edits to a
non-session (admin-owned) track apply in-memory for the current session even
when the user lacks rights to persist them.

```js
// type signature
editTrackConfiguration: (configuration: (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) | { ...; }) => void
```

#### action: setPendingFileHandleIds

```js
// type signature
setPendingFileHandleIds: (ids: string[]) => void
```

</details>
