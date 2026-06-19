---
id: jbrowsewebsessionmodel
title: JBrowseWebSessionModel
sidebar_label: Session -> JBrowseWebSessionModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-web/src/sessionModel/index.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/JBrowseWebSessionModel.md)

## Overview

The full-app web session: the shared web session plus the saved-session database
management surface (favorites, recent sessions, activate/delete).

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseWebSessionModel](../basewebsessionmodel)

**Properties:** sessionPlugins

**Volatiles:** sessionThemeName, pendingFileHandleIds

**Getters:** root, connections, shareURL, textSearchManager

**Methods:** canEditTrack, isTrackOverride, getTrackActions,
getTrackListMenuItems, getTrackActionMenuItems

**Actions:** addAssemblyConf, addSessionPlugin, removeSessionPlugin,
setDefaultSession, setSession, editTrackConfiguration, setPendingFileHandleIds

### Available via [ReferenceManagementSessionMixin](../referencemanagementsessionmixin)

**Methods:** getReferring, getReferringMultiple

**Actions:** removeReferring

### Available via [ThemeManagerSessionMixin](../thememanagersessionmixin)

**Volatiles:** sessionThemeName

**Getters:** themeName, themeOptions, theme

**Methods:** allThemes

**Actions:** setThemeName

### Available via [MultipleViewsSessionMixin](../multipleviewssessionmixin)

**Properties:** views, stickyViewHeaders, useWorkspaces

**Actions:** moveViewDown, moveViewUp, moveViewToTop, moveViewToBottom, addView,
removeView, setStickyViewHeaders, setUseWorkspaces

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

### Available via [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)

**Properties:** drawerPosition, drawerWidth, widgets, activeWidgets, minimized

**Getters:** visibleWidget

**Actions:** setDrawerPosition, updateDrawerWidth, resizeDrawer, addWidget,
showWidget, hideWidget, minimizeWidgetDrawer, showWidgetDrawer, hideAllWidgets,
editConfiguration

### Available via [SessionTracksManagerSessionMixin](../sessiontracksmanagersessionmixin)

**Properties:** sessionTracks

**Getters:** tracks

**Actions:** addTrackConf, updateTrackConfiguration, resetTrackConfiguration,
deleteTrackConf

### Available via [TracksManagerSessionMixin](../tracksmanagersessionmixin)

**Getters:** tracks, getTracksById, tracksById

**Actions:** addTrackConf, updateTrackConfiguration, deleteTrackConf

### Available via [AssembliesMixin](../assembliesmixin)

**Properties:** sessionAssemblies, temporaryAssemblies

**Getters:** assemblies, assemblyNames

**Actions:** addSessionAssembly, addAssembly, removeAssembly,
removeSessionAssembly, addTemporaryAssembly, removeTemporaryAssembly

### Available via [AppSessionMixin](../appsessionmixin)

**Getters:** root, version, gitCommit, history, assemblyManager

**Methods:** renderProps, menus

**Actions:** renameCurrentSession

### Available via [WebSessionConnectionsMixin](../websessionconnectionsmixin)

**Properties:** sessionConnections

**Actions:** addConnectionConf, deleteConnection

### Available via [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin)

**Properties:** connectionInstances

**Getters:** connections

**Actions:** makeConnection, prepareToBreakConnection, breakConnection,
deleteConnection, addConnectionConf, clearConnections

### Available via [DockviewLayoutMixin](../dockviewlayoutmixin)

**Properties:** dockviewLayout, panelViewAssignments, init, pendingMove,
activePanelId

**Getters:** getViewIdsForPanel, getPanelContainingView

**Actions:** setDockviewLayout, setActivePanelId, setInit, setPendingMove,
assignViewToPanel, removeViewFromPanel, removePanel, moveViewUpInPanel,
moveViewDownInPanel, moveViewToTopInPanel, moveViewToBottomInPanel

### Available via [WebSessionManagementMixin](../websessionmanagementmixin)

**Getters:** savedSessionMetadata

**Actions:** deleteSavedSession, setSavedSessionFavorite, renameSavedSession,
activateSession
