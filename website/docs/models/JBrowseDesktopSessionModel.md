---
id: jbrowsedesktopsessionmodel
title: JBrowseDesktopSessionModel
sidebar_label: Session -> JBrowseDesktopSessionModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-desktop/src/sessionModel/sessionModel.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/JBrowseDesktopSessionModel.md)

## Overview

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [ReferenceManagementSessionMixin](../referencemanagementsessionmixin)

**Methods:**
[getReferring](../referencemanagementsessionmixin#method-getreferring),
[getReferringMultiple](../referencemanagementsessionmixin#method-getreferringmultiple)

**Actions:**
[removeReferring](../referencemanagementsessionmixin#action-removereferring)

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

### Available via [ThemeManagerSessionMixin](../thememanagersessionmixin)

**Volatiles:**
[sessionThemeName](../thememanagersessionmixin#volatile-sessionthemename)

**Getters:** [themeName](../thememanagersessionmixin#getter-themename),
[themeOptions](../thememanagersessionmixin#getter-themeoptions),
[theme](../thememanagersessionmixin#getter-theme)

**Methods:** [allThemes](../thememanagersessionmixin#method-allthemes),
[getActiveThemeOptions](../thememanagersessionmixin#method-getactivethemeoptions)

**Actions:** [setThemeName](../thememanagersessionmixin#action-setthemename)

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

### Available via [DesktopSessionTrackMenuMixin](../desktopsessiontrackmenumixin)

**Methods:**
[getTrackActions](../desktopsessiontrackmenumixin#method-gettrackactions)

### Available via [TrackMenuItemsSessionMixin](../trackmenuitemssessionmixin)

**Methods:**
[getTrackListMenuItems](../trackmenuitemssessionmixin#method-gettracklistmenuitems),
[getTrackActionMenuItems](../trackmenuitemssessionmixin#method-gettrackactionmenuitems)

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
