---
id: jbrowsedesktopsessionmodel
title: JBrowseDesktopSessionModel
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

**Methods:** getReferring, getReferringMultiple

**Actions:** removeReferring

### Available via [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin)

**Properties:** connectionInstances

**Getters:** connections

**Actions:** makeConnection, prepareToBreakConnection, breakConnection,
deleteConnection, addConnectionConf, clearConnections

### Available via [ThemeManagerSessionMixin](../thememanagersessionmixin)

**Volatiles:** sessionThemeName

**Getters:** themeName, themeOptions, theme

**Methods:** allThemes

**Actions:** setThemeName

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

### Available via [MultipleViewsSessionMixin](../multipleviewssessionmixin)

**Properties:** views, stickyViewHeaders, useWorkspaces

**Actions:** moveViewDown, moveViewUp, moveViewToTop, moveViewToBottom, addView,
removeView, setStickyViewHeaders, setUseWorkspaces

### Available via [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)

**Properties:** drawerPosition, drawerWidth, widgets, activeWidgets, minimized

**Getters:** visibleWidget

**Actions:** setDrawerPosition, updateDrawerWidth, resizeDrawer, addWidget,
showWidget, hideWidget, minimizeWidgetDrawer, showWidgetDrawer, hideAllWidgets,
editConfiguration

### Available via [AssembliesMixin](../assembliesmixin)

**Properties:** sessionAssemblies, temporaryAssemblies

**Getters:** assemblies, assemblyNames

**Actions:** addSessionAssembly, addAssembly, removeAssembly,
removeSessionAssembly, addTemporaryAssembly, removeTemporaryAssembly

### Available via [AppSessionMixin](../appsessionmixin)

**Getters:** root, version, gitCommit, history, assemblyManager

**Methods:** renderProps, menus

**Actions:** renameCurrentSession

### Available via [DesktopSessionTrackMenuMixin](../desktopsessiontrackmenumixin)

**Methods:** getTrackActions, getTrackListMenuItems, getTrackActionMenuItems

### Available via [DockviewLayoutMixin](../dockviewlayoutmixin)

**Properties:** dockviewLayout, panelViewAssignments, init, pendingMove,
activePanelId

**Getters:** getViewIdsForPanel, getPanelContainingView

**Actions:** setDockviewLayout, setActivePanelId, setInit, setPendingMove,
assignViewToPanel, removeViewFromPanel, removePanel, moveViewUpInPanel,
moveViewDownInPanel, moveViewToTopInPanel, moveViewToBottomInPanel
