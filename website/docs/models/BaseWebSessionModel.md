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

Composable web session shared by jbrowse-web and react-app, before
finalizeWebSession (the snapshotProcessor can't be `compose`d). jbrowse-web
composes `WebSessionManagementMixin` onto this; react-app uses it as-is.

## Members

| Member                                                             | Kind       | Defined by                                                              | Description                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------ | ---------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [sessionPlugins](#property-sessionplugins)                         | Properties | BaseWebSessionModel                                                     |                                                                                                                                                                                                                                                                                                                    |
| [sessionThemeName](#volatile-sessionthemename)                     | Volatiles  | BaseWebSessionModel                                                     |                                                                                                                                                                                                                                                                                                                    |
| [pendingFileHandleIds](#volatile-pendingfilehandleids)             | Volatiles  | BaseWebSessionModel                                                     |                                                                                                                                                                                                                                                                                                                    |
| [root](#getter-root)                                               | Getters    | BaseWebSessionModel                                                     |                                                                                                                                                                                                                                                                                                                    |
| [connections](#getter-connections)                                 | Getters    | BaseWebSessionModel                                                     | list of config connections and session connections                                                                                                                                                                                                                                                                 |
| [shareURL](#getter-shareurl)                                       | Getters    | BaseWebSessionModel                                                     |                                                                                                                                                                                                                                                                                                                    |
| [textSearchManager](#getter-textsearchmanager)                     | Getters    | BaseWebSessionModel                                                     |                                                                                                                                                                                                                                                                                                                    |
| [canEditTrack](#method-canedittrack)                               | Methods    | BaseWebSessionModel                                                     | whether the user may edit this track's config (admins may edit any; everyone else only their own session tracks)                                                                                                                                                                                                   |
| [isTrackOverride](#method-istrackoverride)                         | Methods    | BaseWebSessionModel                                                     | whether `trackId` has a non-admin config override (a delta stored in trackConfigDeltas against an admin-owned config track, see updateTrackConfiguration), rather than a standalone user-added session track.                                                                                                      |
| [getTrackActions](#method-gettrackactions)                         | Methods    | BaseWebSessionModel                                                     | raw track actions (Settings, Copy, Delete) without submenu wrapper                                                                                                                                                                                                                                                 |
| [addAssemblyConf](#action-addassemblyconf)                         | Actions    | BaseWebSessionModel                                                     |                                                                                                                                                                                                                                                                                                                    |
| [addSessionPlugin](#action-addsessionplugin)                       | Actions    | BaseWebSessionModel                                                     |                                                                                                                                                                                                                                                                                                                    |
| [removeSessionPlugin](#action-removesessionplugin)                 | Actions    | BaseWebSessionModel                                                     |                                                                                                                                                                                                                                                                                                                    |
| [setDefaultSession](#action-setdefaultsession)                     | Actions    | BaseWebSessionModel                                                     |                                                                                                                                                                                                                                                                                                                    |
| [setSession](#action-setsession)                                   | Actions    | BaseWebSessionModel                                                     |                                                                                                                                                                                                                                                                                                                    |
| [editTrackConfiguration](#action-edittrackconfiguration)           | Actions    | BaseWebSessionModel                                                     | opens the config editor for a track.                                                                                                                                                                                                                                                                               |
| [setPendingFileHandleIds](#action-setpendingfilehandleids)         | Actions    | BaseWebSessionModel                                                     |                                                                                                                                                                                                                                                                                                                    |
| [getReferringMultiple](#method-getreferringmultiple)               | Methods    | [ReferenceManagementSessionMixin](../referencemanagementsessionmixin)   | Walk the tree once and map each requested trackId to the nodes holding a `types.reference` that resolves to it (a view's track entry, a config editor widget).                                                                                                                                                     |
| [getReferring](#method-getreferring)                               | Methods    | [ReferenceManagementSessionMixin](../referencemanagementsessionmixin)   | The nodes currently referring to `trackId` (see getReferringMultiple).                                                                                                                                                                                                                                             |
| [dereferenceTrack](#action-dereferencetrack)                       | Actions    | [ReferenceManagementSessionMixin](../referencemanagementsessionmixin)   | Remove `trackId` from every view referring to it and close any config editor widget open on it.                                                                                                                                                                                                                    |
| [themeName](#getter-themename)                                     | Getters    | [ThemeManagerSessionMixin](../thememanagersessionmixin)                 |                                                                                                                                                                                                                                                                                                                    |
| [themeOptions](#getter-themeoptions)                               | Getters    | [ThemeManagerSessionMixin](../thememanagersessionmixin)                 |                                                                                                                                                                                                                                                                                                                    |
| [theme](#getter-theme)                                             | Getters    | [ThemeManagerSessionMixin](../thememanagersessionmixin)                 |                                                                                                                                                                                                                                                                                                                    |
| [allThemes](#method-allthemes)                                     | Methods    | [ThemeManagerSessionMixin](../thememanagersessionmixin)                 |                                                                                                                                                                                                                                                                                                                    |
| [getActiveThemeOptions](#method-getactivethemeoptions)             | Methods    | [ThemeManagerSessionMixin](../thememanagersessionmixin)                 | Raw `ThemeOptions` for the active theme, or a named override (used by the SVG-export theme picker).                                                                                                                                                                                                                |
| [setThemeName](#action-setthemename)                               | Actions    | [ThemeManagerSessionMixin](../thememanagersessionmixin)                 |                                                                                                                                                                                                                                                                                                                    |
| [views](#property-views)                                           | Properties | [MultipleViewsSessionMixin](../multipleviewssessionmixin)               |                                                                                                                                                                                                                                                                                                                    |
| [stickyViewHeaders](#property-stickyviewheaders)                   | Properties | [MultipleViewsSessionMixin](../multipleviewssessionmixin)               |                                                                                                                                                                                                                                                                                                                    |
| [useWorkspaces](#property-useworkspaces)                           | Properties | [MultipleViewsSessionMixin](../multipleviewssessionmixin)               | enables the dockview-based tabbed/tiled workspace layout for this session.                                                                                                                                                                                                                                         |
| [effectiveUseWorkspaces](#getter-effectiveuseworkspaces)           | Getters    | [MultipleViewsSessionMixin](../multipleviewssessionmixin)               | resolved workspaces flag (never undefined): this session's value, else the user preference over the `configuration.preferences.useWorkspaces` admin default.                                                                                                                                                       |
| [moveViewDown](#action-moveviewdown)                               | Actions    | [MultipleViewsSessionMixin](../multipleviewssessionmixin)               |                                                                                                                                                                                                                                                                                                                    |
| [moveViewUp](#action-moveviewup)                                   | Actions    | [MultipleViewsSessionMixin](../multipleviewssessionmixin)               |                                                                                                                                                                                                                                                                                                                    |
| [moveViewToTop](#action-moveviewtotop)                             | Actions    | [MultipleViewsSessionMixin](../multipleviewssessionmixin)               |                                                                                                                                                                                                                                                                                                                    |
| [moveViewToBottom](#action-moveviewtobottom)                       | Actions    | [MultipleViewsSessionMixin](../multipleviewssessionmixin)               |                                                                                                                                                                                                                                                                                                                    |
| [addView](#action-addview)                                         | Actions    | [MultipleViewsSessionMixin](../multipleviewssessionmixin)               |                                                                                                                                                                                                                                                                                                                    |
| [removeView](#action-removeview)                                   | Actions    | [MultipleViewsSessionMixin](../multipleviewssessionmixin)               |                                                                                                                                                                                                                                                                                                                    |
| [setStickyViewHeaders](#action-setstickyviewheaders)               | Actions    | [MultipleViewsSessionMixin](../multipleviewssessionmixin)               |                                                                                                                                                                                                                                                                                                                    |
| [setUseWorkspaces](#action-setuseworkspaces)                       | Actions    | [MultipleViewsSessionMixin](../multipleviewssessionmixin)               | set the workspaces layout for this session only, leaving the user's personal default untouched.                                                                                                                                                                                                                    |
| [setUseWorkspacesPreference](#action-setuseworkspacespreference)   | Actions    | [MultipleViewsSessionMixin](../multipleviewssessionmixin)               | the user-facing workspaces toggle: applies to this session and becomes their default for sessions that don't specify one.                                                                                                                                                                                          |
| [resetUseWorkspaces](#action-resetuseworkspaces)                   | Actions    | [MultipleViewsSessionMixin](../multipleviewssessionmixin)               | drop both this session's explicit value and the user's override so workspaces falls back to the admin default                                                                                                                                                                                                      |
| [id](#property-id)                                                 | Properties | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                    |
| [name](#property-name)                                             | Properties | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                    |
| [margin](#property-margin)                                         | Properties | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                    |
| [focusedViewId](#property-focusedviewid)                           | Properties | [BaseSessionModel](../basesessionmodel)                                 | used to keep track of which view is in focus                                                                                                                                                                                                                                                                       |
| [highlightsVisible](#property-highlightsvisible)                   | Properties | [BaseSessionModel](../basesessionmodel)                                 | one session-wide toggle for all region highlight bands (URL/view highlights and bookmark overlays)                                                                                                                                                                                                                 |
| [selection](#volatile-selection)                                   | Volatiles  | [BaseSessionModel](../basesessionmodel)                                 | this is the globally "selected" object.                                                                                                                                                                                                                                                                            |
| [hovered](#volatile-hovered)                                       | Volatiles  | [BaseSessionModel](../basesessionmodel)                                 | this is the globally "hovered" object.                                                                                                                                                                                                                                                                             |
| [queueOfDialogs](#volatile-queueofdialogs)                         | Volatiles  | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                    |
| [preferencesOverrides](#volatile-preferencesoverrides)             | Volatiles  | [BaseSessionModel](../basesessionmodel)                                 | runtime user-preference overrides keyed by preference id, resolved by `getPreference` against the `configuration.preferences` admin defaults.                                                                                                                                                                      |
| [jbrowse](#getter-jbrowse)                                         | Getters    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                    |
| [rpcManager](#getter-rpcmanager)                                   | Getters    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                    |
| [configuration](#getter-configuration)                             | Getters    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                    |
| [adminMode](#getter-adminmode)                                     | Getters    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                    |
| [assemblies](#getter-assemblies)                                   | Getters    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                    |
| [DialogComponent](#getter-dialogcomponent)                         | Getters    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                    |
| [DialogProps](#getter-dialogprops)                                 | Getters    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                    |
| [animationMode](#getter-animationmode)                             | Getters    | [BaseSessionModel](../basesessionmodel)                                 | resolved feature-layout animation mode (never undefined)                                                                                                                                                                                                                                                           |
| [scrollZoom](#getter-scrollzoom)                                   | Getters    | [BaseSessionModel](../basesessionmodel)                                 | resolved scroll-to-zoom preference.                                                                                                                                                                                                                                                                                |
| [getPreference](#method-getpreference)                             | Methods    | [BaseSessionModel](../basesessionmodel)                                 | resolved value of a user preference: a runtime override if the user set one, otherwise the admin/embedder `configuration.preferences` default.                                                                                                                                                                     |
| [getDisplayTypeDefault](#method-getdisplaytypedefault)             | Methods    | [BaseSessionModel](../basesessionmodel)                                 | resolved value of a per-display-type slot default the user promoted (see `setDisplayTypeDefault`); undefined when nothing was promoted.                                                                                                                                                                            |
| [getPreferenceChanges](#method-getpreferencechanges)               | Methods    | [BaseSessionModel](../basesessionmodel)                                 | every runtime preference-override that currently differs from its config/admin default, as `{ path, from, to }` rows — the exact set `clearPreferenceOverrides` reverts.                                                                                                                                           |
| [setSelection](#action-setselection)                               | Actions    | [BaseSessionModel](../basesessionmodel)                                 | set the global selection, i.e. the globally-selected object.                                                                                                                                                                                                                                                       |
| [clearSelection](#action-clearselection)                           | Actions    | [BaseSessionModel](../basesessionmodel)                                 | clears the global selection                                                                                                                                                                                                                                                                                        |
| [setHovered](#action-sethovered)                                   | Actions    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                    |
| [setHighlightsVisible](#action-sethighlightsvisible)               | Actions    | [BaseSessionModel](../basesessionmodel)                                 | toggle all region highlight bands across every view                                                                                                                                                                                                                                                                |
| [revealHighlights](#action-revealhighlights)                       | Actions    | [BaseSessionModel](../basesessionmodel)                                 | turn highlight bands back on, so a newly made highlight or bookmark is never silently swallowed by an earlier "highlights off"                                                                                                                                                                                     |
| [setPreferenceOverride](#action-setpreferenceoverride)             | Actions    | [BaseSessionModel](../basesessionmodel)                                 | set a runtime user-preference override (see `getPreference`).                                                                                                                                                                                                                                                      |
| [clearPreferenceOverrides](#action-clearpreferenceoverrides)       | Actions    | [BaseSessionModel](../basesessionmodel)                                 | clear every runtime preference override at once — scrollZoom, animationMode, and every promoted per-display-type default (see `setDisplayTypeDefault`) — so each falls back to its config/admin default.                                                                                                           |
| [clearPreferenceOverride](#action-clearpreferenceoverride)         | Actions    | [BaseSessionModel](../basesessionmodel)                                 | clear a single runtime preference override (see `getPreference`) so it falls back to its config/admin default.                                                                                                                                                                                                     |
| [setScrollZoom](#action-setscrollzoom)                             | Actions    | [BaseSessionModel](../basesessionmodel)                                 | set the global scroll-to-zoom preference (see the `scrollZoom` getter)                                                                                                                                                                                                                                             |
| [setDisplayTypeDefault](#action-setdisplaytypedefault)             | Actions    | [BaseSessionModel](../basesessionmodel)                                 | promote (or, with `value` undefined, clear) a per-display-type slot default.                                                                                                                                                                                                                                       |
| [setName](#action-setname)                                         | Actions    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                    |
| [setFocusedViewId](#action-setfocusedviewid)                       | Actions    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                    |
| [removeActiveDialog](#action-removeactivedialog)                   | Actions    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                    |
| [queueDialog](#action-queuedialog)                                 | Actions    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                    |
| [snackbarMessages](#volatile-snackbarmessages)                     | Volatiles  | [SnackbarModel](../snackbarmodel)                                       |                                                                                                                                                                                                                                                                                                                    |
| [errorDialog](#volatile-errordialog)                               | Volatiles  | [SnackbarModel](../snackbarmodel)                                       | the error currently shown in the stack-trace dialog.                                                                                                                                                                                                                                                               |
| [snackbarMessageSet](#getter-snackbarmessageset)                   | Getters    | [SnackbarModel](../snackbarmodel)                                       |                                                                                                                                                                                                                                                                                                                    |
| [notify](#action-notify)                                           | Actions    | [SnackbarModel](../snackbarmodel)                                       |                                                                                                                                                                                                                                                                                                                    |
| [notifyError](#action-notifyerror)                                 | Actions    | [SnackbarModel](../snackbarmodel)                                       |                                                                                                                                                                                                                                                                                                                    |
| [setErrorDialog](#action-seterrordialog)                           | Actions    | [SnackbarModel](../snackbarmodel)                                       |                                                                                                                                                                                                                                                                                                                    |
| [pushSnackbarMessage](#action-pushsnackbarmessage)                 | Actions    | [SnackbarModel](../snackbarmodel)                                       |                                                                                                                                                                                                                                                                                                                    |
| [popSnackbarMessage](#action-popsnackbarmessage)                   | Actions    | [SnackbarModel](../snackbarmodel)                                       |                                                                                                                                                                                                                                                                                                                    |
| [removeSnackbarMessage](#action-removesnackbarmessage)             | Actions    | [SnackbarModel](../snackbarmodel)                                       |                                                                                                                                                                                                                                                                                                                    |
| [drawerPosition](#property-drawerposition)                         | Properties | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                    |
| [drawerWidth](#property-drawerwidth)                               | Properties | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                    |
| [widgets](#property-widgets)                                       | Properties | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                    |
| [activeWidgets](#property-activewidgets)                           | Properties | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                    |
| [minimized](#property-minimized)                                   | Properties | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                    |
| [poppedOut](#volatile-poppedout)                                   | Volatiles  | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 | true while the visible widget is shown in a modal dialog instead of the drawer.                                                                                                                                                                                                                                    |
| [visibleWidget](#getter-visiblewidget)                             | Getters    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                    |
| [setDrawerPosition](#action-setdrawerposition)                     | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                    |
| [updateDrawerWidth](#action-updatedrawerwidth)                     | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                    |
| [resizeDrawer](#action-resizedrawer)                               | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                    |
| [addWidget](#action-addwidget)                                     | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                    |
| [showWidget](#action-showwidget)                                   | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                    |
| [hideWidget](#action-hidewidget)                                   | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                    |
| [minimizeWidgetDrawer](#action-minimizewidgetdrawer)               | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                    |
| [showWidgetDrawer](#action-showwidgetdrawer)                       | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                    |
| [popoutWidget](#action-popoutwidget)                               | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 | show the visible widget in a modal dialog, freeing the drawer column                                                                                                                                                                                                                                               |
| [returnWidgetToDrawer](#action-returnwidgettodrawer)               | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                    |
| [hideAllWidgets](#action-hideallwidgets)                           | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                    |
| [editConfiguration](#action-editconfiguration)                     | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 | opens a configuration editor to configure the given thing, and sets the current task to be configuring it                                                                                                                                                                                                          |
| [sessionTracks](#property-sessiontracks)                           | Properties | [SessionTracksManagerSessionMixin](../sessiontracksmanagersessionmixin) | User-added session tracks (no matching admin config track).                                                                                                                                                                                                                                                        |
| [trackConfigDeltas](#property-trackconfigdeltas)                   | Properties | [SessionTracksManagerSessionMixin](../sessiontracksmanagersessionmixin) | Per-track config overrides for a non-admin, keyed by trackId, stored as a _delta_ against the admin-owned base config (jbrowse.tracks entry) rather than a full copy — so a later admin change to an untouched field still flows through (see trackConfigDelta.ts).                                                |
| [editableTrackConfigs](#volatile-editabletrackconfigs)             | Volatiles  | [SessionTracksManagerSessionMixin](../sessiontracksmanagersessionmixin) | Per-track private working copies (non-admin), keyed by trackId.                                                                                                                                                                                                                                                    |
| [tracks](#getter-tracks)                                           | Getters    | [SessionTracksManagerSessionMixin](../sessiontracksmanagersessionmixin) | User-added session tracks first, then each admin config track with its delta (trackConfigDeltas) merged over it.                                                                                                                                                                                                   |
| [getTrackConfigChanges](#method-gettrackconfigchanges)             | Methods    | [SessionTracksManagerSessionMixin](../sessiontracksmanagersessionmixin) | The overridden slots for `trackId` (empty when it has no delta): each changed setting's path, its base/default value and the edited value.                                                                                                                                                                         |
| [getEditableTrackConfig](#method-geteditabletrackconfig)           | Methods    | [SessionTracksManagerSessionMixin](../sessiontracksmanagersessionmixin) | A non-admin's private working copy of a track config, created on first access from the current frozen (base+delta) value and cached by trackId, so a shown track's in-place quick-edits (setSlot) mutate this copy and never the shared frozen base node (see ADR-032).                                            |
| [addTrackConf](#action-addtrackconf)                               | Actions    | [SessionTracksManagerSessionMixin](../sessiontracksmanagersessionmixin) |                                                                                                                                                                                                                                                                                                                    |
| [updateTrackConfiguration](#action-updatetrackconfiguration)       | Actions    | [SessionTracksManagerSessionMixin](../sessiontracksmanagersessionmixin) | Persist a non-admin's edited track config as a delta (trackConfigDeltas) against the admin-owned base — only the changed slots — so the edits persist and are shared while admin changes to untouched fields still flow through.                                                                                   |
| [resetTrackConfiguration](#action-resettrackconfiguration)         | Actions    | [SessionTracksManagerSessionMixin](../sessiontracksmanagersessionmixin) | Drop a non-admin's delta (trackConfigDeltas) so the track reverts to its admin config (jbrowse.tracks) default.                                                                                                                                                                                                    |
| [deleteTrackConf](#action-deletetrackconf)                         | Actions    | [SessionTracksManagerSessionMixin](../sessiontracksmanagersessionmixin) |                                                                                                                                                                                                                                                                                                                    |
| [getTrackById](#method-gettrackbyid)                               | Methods    | [TracksManagerSessionMixin](../tracksmanagersessionmixin)               | Config for one trackId — a track, assembly sequence, or connection track — or undefined.                                                                                                                                                                                                                           |
| [getTracksById](#method-gettracksbyid)                             | Methods    | [TracksManagerSessionMixin](../tracksmanagersessionmixin)               |                                                                                                                                                                                                                                                                                                                    |
| [sessionAssemblies](#property-sessionassemblies)                   | Properties | [AssembliesMixin](../assembliesmixin)                                   |                                                                                                                                                                                                                                                                                                                    |
| [temporaryAssemblies](#property-temporaryassemblies)               | Properties | [AssembliesMixin](../assembliesmixin)                                   |                                                                                                                                                                                                                                                                                                                    |
| [assemblyNames](#getter-assemblynames)                             | Getters    | [AssembliesMixin](../assembliesmixin)                                   | names of the assemblies returned by the `assemblies` getter                                                                                                                                                                                                                                                        |
| [addSessionAssembly](#action-addsessionassembly)                   | Actions    | [AssembliesMixin](../assembliesmixin)                                   |                                                                                                                                                                                                                                                                                                                    |
| [addAssembly](#action-addassembly)                                 | Actions    | [AssembliesMixin](../assembliesmixin)                                   |                                                                                                                                                                                                                                                                                                                    |
| [removeAssembly](#action-removeassembly)                           | Actions    | [AssembliesMixin](../assembliesmixin)                                   |                                                                                                                                                                                                                                                                                                                    |
| [removeSessionAssembly](#action-removesessionassembly)             | Actions    | [AssembliesMixin](../assembliesmixin)                                   |                                                                                                                                                                                                                                                                                                                    |
| [addTemporaryAssembly](#action-addtemporaryassembly)               | Actions    | [AssembliesMixin](../assembliesmixin)                                   | used for read vs ref type assemblies.                                                                                                                                                                                                                                                                              |
| [removeTemporaryAssembly](#action-removetemporaryassembly)         | Actions    | [AssembliesMixin](../assembliesmixin)                                   |                                                                                                                                                                                                                                                                                                                    |
| [version](#getter-version)                                         | Getters    | [AppSessionMixin](../appsessionmixin)                                   |                                                                                                                                                                                                                                                                                                                    |
| [gitCommit](#getter-gitcommit)                                     | Getters    | [AppSessionMixin](../appsessionmixin)                                   |                                                                                                                                                                                                                                                                                                                    |
| [history](#getter-history)                                         | Getters    | [AppSessionMixin](../appsessionmixin)                                   |                                                                                                                                                                                                                                                                                                                    |
| [assemblyManager](#getter-assemblymanager)                         | Getters    | [AppSessionMixin](../appsessionmixin)                                   |                                                                                                                                                                                                                                                                                                                    |
| [menus](#method-menus)                                             | Methods    | [AppSessionMixin](../appsessionmixin)                                   |                                                                                                                                                                                                                                                                                                                    |
| [renameCurrentSession](#action-renamecurrentsession)               | Actions    | [AppSessionMixin](../appsessionmixin)                                   |                                                                                                                                                                                                                                                                                                                    |
| [sessionConnections](#property-sessionconnections)                 | Properties | [WebSessionConnectionsMixin](../websessionconnectionsmixin)             |                                                                                                                                                                                                                                                                                                                    |
| [addConnectionConf](#action-addconnectionconf)                     | Actions    | [WebSessionConnectionsMixin](../websessionconnectionsmixin)             |                                                                                                                                                                                                                                                                                                                    |
| [deleteConnection](#action-deleteconnection)                       | Actions    | [WebSessionConnectionsMixin](../websessionconnectionsmixin)             |                                                                                                                                                                                                                                                                                                                    |
| [connectionInstances](#property-connectioninstances)               | Properties | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) |                                                                                                                                                                                                                                                                                                                    |
| [connectionTrackConfigs](#property-connectiontrackconfigs)         | Properties | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Persisted configs of connection tracks the user has opened, keyed by trackId.                                                                                                                                                                                                                                      |
| [makeConnection](#action-makeconnection)                           | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) |                                                                                                                                                                                                                                                                                                                    |
| [breakConnection](#action-breakconnection)                         | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Remove a live connection instance.                                                                                                                                                                                                                                                                                 |
| [teardownConnection](#action-teardownconnection)                   | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Close every track a connection contributed — the live instance's tracks plus any persisted open-track configs (a dormant connection, never expanded this session, still renders its opened tracks from `connectionTrackConfigs`) — from all views/widgets, drop the live instance, and drop the persisted configs. |
| [clearConnections](#action-clearconnections)                       | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) |                                                                                                                                                                                                                                                                                                                    |
| [captureConnectionTrack](#action-captureconnectiontrack)           | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Snapshot a just-opened connection track's config into `connectionTrackConfigs` so it survives session reload.                                                                                                                                                                                                      |
| [updateConnectionTrackConfig](#action-updateconnectiontrackconfig) | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Persist an edit to an opened connection track.                                                                                                                                                                                                                                                                     |
| [setConnectionTrackConfig](#action-setconnectiontrackconfig)       | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Upsert one opened connection track's persisted config.                                                                                                                                                                                                                                                             |
| [pruneConnectionTrackConfig](#action-pruneconnectiontrackconfig)   | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Drop a connection track's persisted config once no open view still references it, so the session doesn't accumulate closed tracks.                                                                                                                                                                                 |
| [hydrateConnection](#action-hydrateconnection)                     | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Lazily establish a single connection by id if it isn't already live — used when its category is expanded in the track selector.                                                                                                                                                                                    |
| [dockviewLayout](#property-dockviewlayout)                         | Properties | [DockviewLayoutMixin](../dockviewlayoutmixin)                           | Serialized dockview layout state                                                                                                                                                                                                                                                                                   |
| [panelViewAssignments](#property-panelviewassignments)             | Properties | [DockviewLayoutMixin](../dockviewlayoutmixin)                           | Maps panel IDs to arrays of view IDs (for stacking views within a panel)                                                                                                                                                                                                                                           |
| [activePanelId](#property-activepanelid)                           | Properties | [DockviewLayoutMixin](../dockviewlayoutmixin)                           | The currently active panel ID in dockview                                                                                                                                                                                                                                                                          |
| [init](#property-init)                                             | Properties | [DockviewLayoutMixin](../dockviewlayoutmixin)                           | The initial nested layout to build dockview from (simple viewIds/ direction/size form, vs.                                                                                                                                                                                                                         |
| [pendingMove](#volatile-pendingmove)                               | Volatiles  | [DockviewLayoutMixin](../dockviewlayoutmixin)                           |                                                                                                                                                                                                                                                                                                                    |
| [getViewIdsForPanel](#getter-getviewidsforpanel)                   | Getters    | [DockviewLayoutMixin](../dockviewlayoutmixin)                           | Get view IDs for a specific panel, as a plain snapshot array.                                                                                                                                                                                                                                                      |
| [getPanelContainingView](#getter-getpanelcontainingview)           | Getters    | [DockviewLayoutMixin](../dockviewlayoutmixin)                           | Find the panel containing a view, returning the panel ID, that panel's view-ID list, and the view's index within it (or undefined if unassigned)                                                                                                                                                                   |
| [setDockviewLayout](#action-setdockviewlayout)                     | Actions    | [DockviewLayoutMixin](../dockviewlayoutmixin)                           | Save the current dockview layout                                                                                                                                                                                                                                                                                   |
| [setActivePanelId](#action-setactivepanelid)                       | Actions    | [DockviewLayoutMixin](../dockviewlayoutmixin)                           | Set the active panel ID                                                                                                                                                                                                                                                                                            |
| [setInit](#action-setinit)                                         | Actions    | [DockviewLayoutMixin](../dockviewlayoutmixin)                           | Set the initial layout configuration (from URL params)                                                                                                                                                                                                                                                             |
| [setPendingMove](#action-setpendingmove)                           | Actions    | [DockviewLayoutMixin](../dockviewlayoutmixin)                           | Queue a view move to be applied when the dockview container mounts                                                                                                                                                                                                                                                 |
| [assignViewToPanel](#action-assignviewtopanel)                     | Actions    | [DockviewLayoutMixin](../dockviewlayoutmixin)                           | Assign a view to a panel (adds to the panel's view stack)                                                                                                                                                                                                                                                          |
| [removeViewFromPanel](#action-removeviewfrompanel)                 | Actions    | [DockviewLayoutMixin](../dockviewlayoutmixin)                           | Remove a view from its panel                                                                                                                                                                                                                                                                                       |
| [removePanel](#action-removepanel)                                 | Actions    | [DockviewLayoutMixin](../dockviewlayoutmixin)                           | Remove a panel and all its view assignments                                                                                                                                                                                                                                                                        |
| [moveViewUpInPanel](#action-moveviewupinpanel)                     | Actions    | [DockviewLayoutMixin](../dockviewlayoutmixin)                           | Move a view up within its panel's view stack                                                                                                                                                                                                                                                                       |
| [moveViewDownInPanel](#action-moveviewdowninpanel)                 | Actions    | [DockviewLayoutMixin](../dockviewlayoutmixin)                           | Move a view down within its panel's view stack                                                                                                                                                                                                                                                                     |
| [moveViewToTopInPanel](#action-moveviewtotopinpanel)               | Actions    | [DockviewLayoutMixin](../dockviewlayoutmixin)                           | Move a view to the top of its panel's view stack                                                                                                                                                                                                                                                                   |
| [moveViewToBottomInPanel](#action-moveviewtobottominpanel)         | Actions    | [DockviewLayoutMixin](../dockviewlayoutmixin)                           | Move a view to the bottom of its panel's view stack                                                                                                                                                                                                                                                                |
| [getTrackListMenuItems](#method-gettracklistmenuitems)             | Methods    | [TrackMenuItemsSessionMixin](../trackmenuitemssessionmixin)             | flattened menu items for use in hierarchical track selector                                                                                                                                                                                                                                                        |
| [getTrackActionMenuItems](#method-gettrackactionmenuitems)         | Methods    | [TrackMenuItemsSessionMixin](../trackmenuitemssessionmixin)             | track menu with About + "Track actions" submenu for the in-view label                                                                                                                                                                                                                                              |

<details>
<summary>BaseWebSessionModel - Properties</summary>

| Member                                                   | Type                                                                                                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| <span id="property-sessionplugins">sessionPlugins</span> | `IArrayType<IType<PluginDefinition & { name: string; }, PluginDefinition & { name: string; }, PluginDefinition & { name: string; }>>` |

</details>

<details>
<summary>BaseWebSessionModel - Volatiles</summary>

| Member                                                               | Type       |
| -------------------------------------------------------------------- | ---------- |
| <span id="volatile-sessionthemename">sessionThemeName</span>         | `string`   |
| <span id="volatile-pendingfilehandleids">pendingFileHandleIds</span> | `string[]` |

</details>

<details>
<summary>BaseWebSessionModel - Getters</summary>

#### getter: connections

list of config connections and session connections

```ts
type connections = (ModelInstanceTypeProps<…> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]
```

</details>

<details>
<summary>BaseWebSessionModel - Getters (other undocumented members)</summary>

| Member                                                       | Type                   |
| ------------------------------------------------------------ | ---------------------- |
| <span id="getter-root">root</span>                           | `AbstractWebRootModel` |
| <span id="getter-shareurl">shareURL</span>                   | `any`                  |
| <span id="getter-textsearchmanager">textSearchManager</span> | `TextSearchManager`    |

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
type getTrackActions = (config: ModelInstanceTypeProps<…> & {…} & IStateTreeNode<…>, view?: TrackActionView | undefined) => MenuItem[]
```

</details>

<details>
<summary>BaseWebSessionModel - Actions</summary>

#### action: editTrackConfiguration

opens the config editor for a track. Available for any track: a non-admin's
edits to an admin-owned track persist as a delta (trackConfigDeltas) that rides
along in the shared/saved session, rather than mutating the admin-owned config
itself.

```ts
type editTrackConfiguration = (configuration: (ModelInstanceTypeProps<…> & {…} & IStateTreeNode<…>) | { ...; }) => void
```

</details>

<details>
<summary>BaseWebSessionModel - Actions (other undocumented members)</summary>

| Member                                                                   | Type                                                                                                                                            |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| <span id="action-addassemblyconf">addAssemblyConf</span>                 | `(conf: AnyConfiguration) => void`                                                                                                              |
| <span id="action-addsessionplugin">addSessionPlugin</span>               | `(plugin: PluginDefinition & { name: string; }) => void`                                                                                        |
| <span id="action-removesessionplugin">removeSessionPlugin</span>         | `(pluginDefinition: PluginDefinition) => void`                                                                                                  |
| <span id="action-setdefaultsession">setDefaultSession</span>             | `() => void`                                                                                                                                    |
| <span id="action-setsession">setSession</span>                           | `(sessionSnapshot: ModelCreationType<ExtractCFromProps<_OverrideProps<_OverrideProps<…>, { sessionPlugins: IArrayType<IType<…>>; }>>>) => void` |
| <span id="action-setpendingfilehandleids">setPendingFileHandleIds</span> | `(ids: string[]) => void`                                                                                                                       |

</details>

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from ReferenceManagementSessionMixin</summary>

[ReferenceManagementSessionMixin →](../referencemanagementsessionmixin)

**Methods**

#### method: getReferringMultiple

Walk the tree once and map each requested trackId to the nodes holding a
`types.reference` that resolves to it (a view's track entry, a config editor
widget). Track configs are matched by trackId, not identity, so a frozen base
and its hydrated MST node compare equal.

```ts
type getReferringMultiple = (trackIds: string[]) => Map<string, ReferringNode[]>
```

#### method: getReferring

The nodes currently referring to `trackId` (see getReferringMultiple).

```ts
type getReferring = (trackId: string) => ReferringNode[]
```

**Actions**

#### action: dereferenceTrack

Remove `trackId` from every view referring to it and close any config editor
widget open on it. Runs immediately: the walk that produced `referring` has
finished, so mutating those views here is safe.

```ts
type dereferenceTrack = (trackId: string, referring: ReferringNode[]) => void
```

</details>

<details>
<summary>Derived from ThemeManagerSessionMixin</summary>

[ThemeManagerSessionMixin →](../thememanagersessionmixin)

**Getters**

| Member                                             | Type                    |
| -------------------------------------------------- | ----------------------- |
| <span id="getter-themename">themeName</span>       | `string`                |
| <span id="getter-themeoptions">themeOptions</span> | `SerializableThemeArgs` |
| <span id="getter-theme">theme</span>               | `Theme`                 |

**Methods**

#### method: getActiveThemeOptions

Raw `ThemeOptions` for the active theme, or a named override (used by the
SVG-export theme picker). Unlike `theme` (a built, non-serializable MUI theme),
this is the plain options object every view's SVG export threads into each
display's `renderSvg`, which rebuilds the theme via `createJBrowseTheme` outside
React context.

```ts
type getActiveThemeOptions = (
  name?: string | undefined,
) => ThemeOptions & { name?: string | undefined }
```

| Member                                       | Type             |
| -------------------------------------------- | ---------------- |
| <span id="method-allthemes">allThemes</span> | `() => ThemeMap` |

**Actions**

| Member                                             | Type                     |
| -------------------------------------------------- | ------------------------ |
| <span id="action-setthemename">setThemeName</span> | `(name: string) => void` |

</details>

<details>
<summary>Derived from MultipleViewsSessionMixin</summary>

[MultipleViewsSessionMixin →](../multipleviewssessionmixin)

**Properties**

#### property: useWorkspaces

enables the dockview-based tabbed/tiled workspace layout for this session.
Undefined means unspecified — read `effectiveUseWorkspaces`.

```ts
// type signature
type useWorkspaces = IOptionalIType<IMaybe<ISimpleType<boolean>>, [undefined]>
// code
useWorkspaces: types.stripDefault(types.maybe(types.boolean), undefined)
```

| Member                                                         | Type                                                |
| -------------------------------------------------------------- | --------------------------------------------------- |
| <span id="property-views">views</span>                         | `IArrayType<IAnyType>`                              |
| <span id="property-stickyviewheaders">stickyViewHeaders</span> | `IOptionalIType<ISimpleType<boolean>, [undefined]>` |

**Getters**

#### getter: effectiveUseWorkspaces

resolved workspaces flag (never undefined): this session's value, else the user
preference over the `configuration.preferences.useWorkspaces` admin default.
Every consumer reads this, not the raw property — only sessions built from a
snapshot or a spec `layout` set that, so the admin default is what reaches the
arrivals that bypass defaultSession.

```ts
type effectiveUseWorkspaces = boolean
```

**Actions**

#### action: setUseWorkspaces

set the workspaces layout for this session only, leaving the user's personal
default untouched. For session-scoped intent — a spec carrying a `layout`, or an
ad-hoc "move view to a tab/split" — where rewriting the visitor's global
preference would be a surprise. The user-facing default toggle is
`setUseWorkspacesPreference`.

```ts
type setUseWorkspaces = (useWorkspaces: boolean) => void
```

#### action: setUseWorkspacesPreference

the user-facing workspaces toggle: applies to this session and becomes their
default for sessions that don't specify one. Persisted only here, on an explicit
toggle — an autorun mirroring the resolved value would bake the admin default
into every visitor's localStorage on first load, so a later admin change could
never reach them.

```ts
type setUseWorkspacesPreference = (useWorkspaces: boolean) => void
```

#### action: resetUseWorkspaces

drop both this session's explicit value and the user's override so workspaces
falls back to the admin default

```ts
type resetUseWorkspaces = () => void
```

| Member                                                             | Type                                            |
| ------------------------------------------------------------------ | ----------------------------------------------- |
| <span id="action-moveviewdown">moveViewDown</span>                 | `(id: string) => void`                          |
| <span id="action-moveviewup">moveViewUp</span>                     | `(id: string) => void`                          |
| <span id="action-moveviewtotop">moveViewToTop</span>               | `(id: string) => void`                          |
| <span id="action-moveviewtobottom">moveViewToBottom</span>         | `(id: string) => void`                          |
| <span id="action-addview">addView</span>                           | `(typeName: string, initialState?: any) => any` |
| <span id="action-removeview">removeView</span>                     | `(view: IBaseViewModel) => void`                |
| <span id="action-setstickyviewheaders">setStickyViewHeaders</span> | `(sticky: boolean) => void`                     |

</details>

<details>
<summary>Derived from BaseSessionModel</summary>

[BaseSessionModel →](../basesessionmodel)

**Properties**

#### property: focusedViewId

used to keep track of which view is in focus

```ts
// type signature
type focusedViewId = IMaybe<ISimpleType<string>>
// code
focusedViewId: types.maybe(types.string)
```

#### property: highlightsVisible

one session-wide toggle for all region highlight bands (URL/view highlights and
bookmark overlays)

```ts
// type signature
type highlightsVisible = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
highlightsVisible: types.stripDefault(types.boolean, true)
```

| Member                                   | Type                                               |
| ---------------------------------------- | -------------------------------------------------- |
| <span id="property-id">id</span>         | `IOptionalIType<ISimpleType<string>, [undefined]>` |
| <span id="property-name">name</span>     | `ISimpleType<string>`                              |
| <span id="property-margin">margin</span> | `IOptionalIType<ISimpleType<number>, [undefined]>` |

**Volatiles**

#### volatile: selection

this is the globally "selected" object. can be anything. code that wants to deal
with this should examine it to see what kind of thing it is.

```ts
// type signature
type selection = unknown
// code
selection: undefined as unknown
```

#### volatile: hovered

this is the globally "hovered" object. can be anything. code that wants to deal
with this should examine it to see what kind of thing it is.

```ts
// type signature
type hovered = unknown
// code
hovered: undefined as unknown
```

#### volatile: preferencesOverrides

runtime user-preference overrides keyed by preference id, resolved by
`getPreference` against the `configuration.preferences` admin defaults. Empty
here (config-only); products that let users edit preferences load and persist
these via localStorage. A runtime override map layered over config defaults,
kept off the snapshot since prefs are local UI.

An `observable.map` (not a plain object reassigned wholesale) so each preference
is its own tracked key: writing one (`setScrollZoom`) can't invalidate a reader
of another (`getDisplayTypeDefault` in a track's `rpcProps`). A single
spread-replaced object made every setter wake every reader, so toggling
scroll-to-zoom re-fetched every track. For the same reason each promoted
per-display-type default is a flat composite key (see `displayTypeDefaultKey`),
not a single nested `displayTypeDefaults` object — promoting one default can't
wake readers of a different one.

```ts
// type signature
type preferencesOverrides = ObservableMap<string, unknown>
// code
preferencesOverrides: observable.map<string, unknown>()
```

| Member                                                   | Type                                               |
| -------------------------------------------------------- | -------------------------------------------------- |
| <span id="volatile-queueofdialogs">queueOfDialogs</span> | `[DialogComponentType, Record<string, unknown>][]` |

**Getters**

#### getter: animationMode

resolved feature-layout animation mode (never undefined)

```ts
type animationMode = AnimationMode
```

#### getter: scrollZoom

resolved scroll-to-zoom preference. Global and personal (never shared in a
session snapshot); every wheel-zoom view reads this single value.

```ts
type scrollZoom = boolean
```

| Member                                                   | Type                                                                                                                                                                             |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <span id="getter-jbrowse">jbrowse</span>                 | `any`                                                                                                                                                                            |
| <span id="getter-rpcmanager">rpcManager</span>           | `RpcManager`                                                                                                                                                                     |
| <span id="getter-configuration">configuration</span>     | `Instance<JB_CONFIG_SCHEMA>`                                                                                                                                                     |
| <span id="getter-adminmode">adminMode</span>             | `boolean`                                                                                                                                                                        |
| <span id="getter-assemblies">assemblies</span>           | `(ModelInstanceTypeProps<…> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]` |
| <span id="getter-dialogcomponent">DialogComponent</span> | `DialogComponentType`                                                                                                                                                            |
| <span id="getter-dialogprops">DialogProps</span>         | `Record<string, unknown>`                                                                                                                                                        |

**Methods**

#### method: getPreference

resolved value of a user preference: a runtime override if the user set one,
otherwise the admin/embedder `configuration.preferences` default. The override
map is empty unless the product loads it (web/desktop).

```ts
type getPreference = (key: string) => unknown
```

#### method: getDisplayTypeDefault

resolved value of a per-display-type slot default the user promoted (see
`setDisplayTypeDefault`); undefined when nothing was promoted.

```ts
type getDisplayTypeDefault = (displayType: string, slot: string) => unknown
```

#### method: getPreferenceChanges

every runtime preference-override that currently differs from its config/admin
default, as `{ path, from, to }` rows — the exact set `clearPreferenceOverrides`
reverts. Backs the confirmation diff shown before "Reset to defaults" (mirrors
the per-track changes dialog). A scalar pref (animationMode, scrollZoom) whose
override equals the default is omitted (reverting it is a no-op); each promoted
per-display-type default is always a difference from the un-promoted state, so
`from` reads "(default)".

```ts
type getPreferenceChanges = () => TrackConfigChange[]
```

**Actions**

#### action: setSelection

set the global selection, i.e. the globally-selected object. can be a feature, a
view, just about anything

```ts
type setSelection = (thing: unknown) => void
```

#### action: clearSelection

clears the global selection

```ts
type clearSelection = () => void
```

#### action: setHighlightsVisible

toggle all region highlight bands across every view

```ts
type setHighlightsVisible = (arg: boolean) => void
```

#### action: revealHighlights

turn highlight bands back on, so a newly made highlight or bookmark is never
silently swallowed by an earlier "highlights off"

```ts
type revealHighlights = () => void
```

#### action: setPreferenceOverride

set a runtime user-preference override (see `getPreference`). Mutates volatile
state; products persist these to localStorage. An `undefined` value deletes the
key (rather than leaving a phantom entry that `getPreference` reads as absent)
so the store never holds dead keys.

```ts
type setPreferenceOverride = (key: string, value: unknown) => void
```

#### action: clearPreferenceOverrides

clear every runtime preference override at once — scrollZoom, animationMode, and
every promoted per-display-type default (see `setDisplayTypeDefault`) — so each
falls back to its config/admin default. Backs the Preferences dialog "Reset to
defaults" button.

```ts
type clearPreferenceOverrides = () => void
```

#### action: clearPreferenceOverride

clear a single runtime preference override (see `getPreference`) so it falls
back to its config/admin default. Backs the per-entry reset in the Preferences
dialog "Reset to defaults" confirmation.

```ts
type clearPreferenceOverride = (key: string) => void
```

#### action: setScrollZoom

set the global scroll-to-zoom preference (see the `scrollZoom` getter)

```ts
type setScrollZoom = (flag: boolean) => void
```

#### action: setDisplayTypeDefault

promote (or, with `value` undefined, clear) a per-display-type slot default.
Just a preference override under one flat composite key (see
`displayTypeDefaultKey`), so it persists and independently tracks like any other
pref, and clearing deletes only that key.

```ts
type setDisplayTypeDefault = (
  displayType: string,
  slot: string,
  value: unknown,
) => void
```

| Member                                                         | Type                                   |
| -------------------------------------------------------------- | -------------------------------------- |
| <span id="action-sethovered">setHovered</span>                 | `(thing: unknown) => void`             |
| <span id="action-setname">setName</span>                       | `(str: string) => void`                |
| <span id="action-setfocusedviewid">setFocusedViewId</span>     | `(viewId: string) => void`             |
| <span id="action-removeactivedialog">removeActiveDialog</span> | `() => void`                           |
| <span id="action-queuedialog">queueDialog</span>               | `(doneCallback: DoneCallback) => void` |

</details>

<details>
<summary>Derived from SnackbarModel</summary>

[SnackbarModel →](../snackbarmodel)

**Volatiles**

#### volatile: errorDialog

the error currently shown in the stack-trace dialog. Kept off the dialog queue
so it can stack on top of an already-open dialog (e.g. the one whose action
raised the error) instead of waiting behind it

```ts
// type signature
type errorDialog = ErrorDialogState | undefined
// code
errorDialog: undefined as ErrorDialogState | undefined
```

| Member                                                       | Type                                |
| ------------------------------------------------------------ | ----------------------------------- |
| <span id="volatile-snackbarmessages">snackbarMessages</span> | `IObservableArray<SnackbarMessage>` |

**Getters**

| Member                                                         | Type                           |
| -------------------------------------------------------------- | ------------------------------ |
| <span id="getter-snackbarmessageset">snackbarMessageSet</span> | `Map<string, SnackbarMessage>` |

**Actions**

| Member                                                               | Type                                                                                                                    |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| <span id="action-notify">notify</span>                               | `(message: string, level?: NotificationLevel \| undefined, action?: SnackAction \| SnackAction[] \| undefined) => void` |
| <span id="action-notifyerror">notifyError</span>                     | `(errorMessage: string, error?: unknown, extra?: unknown, action?: SnackAction \| undefined) => void`                   |
| <span id="action-seterrordialog">setErrorDialog</span>               | `(state: ErrorDialogState \| undefined) => void`                                                                        |
| <span id="action-pushsnackbarmessage">pushSnackbarMessage</span>     | `(message: string, level?: NotificationLevel \| undefined, actions?: SnackAction[] \| undefined) => void`               |
| <span id="action-popsnackbarmessage">popSnackbarMessage</span>       | `() => SnackbarMessage \| undefined`                                                                                    |
| <span id="action-removesnackbarmessage">removeSnackbarMessage</span> | `(message: string) => void`                                                                                             |

</details>

<details>
<summary>Derived from DrawerWidgetSessionMixin</summary>

[DrawerWidgetSessionMixin →](../drawerwidgetsessionmixin)

**Properties**

| Member                                                   | Type                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------- |
| <span id="property-drawerposition">drawerPosition</span> | `IOptionalIType<ISimpleType<string>, [undefined]>`                        |
| <span id="property-drawerwidth">drawerWidth</span>       | `IOptionalIType<ISimpleType<number>, [undefined]>`                        |
| <span id="property-widgets">widgets</span>               | `IOptionalIType<IMapType<IAnyType>, [undefined]>`                         |
| <span id="property-activewidgets">activeWidgets</span>   | `IOptionalIType<IMapType<IMaybe<IReferenceType<IAnyType>>>, [undefined]>` |
| <span id="property-minimized">minimized</span>           | `IOptionalIType<ISimpleType<boolean>, [undefined]>`                       |

**Volatiles**

#### volatile: poppedOut

true while the visible widget is shown in a modal dialog instead of the drawer.
Volatile because a restored session that opened straight into a modal, with no
drawer behind it, is disorienting

```ts
// type signature
type poppedOut = false
// code
poppedOut: false
```

**Getters**

| Member                                               | Type  |
| ---------------------------------------------------- | ----- |
| <span id="getter-visiblewidget">visibleWidget</span> | `any` |

**Actions**

#### action: popoutWidget

show the visible widget in a modal dialog, freeing the drawer column

```ts
type popoutWidget = () => void
```

#### action: editConfiguration

opens a configuration editor to configure the given thing, and sets the current
task to be configuring it

```ts
type editConfiguration = (configuration: (ModelInstanceTypeProps<…> & {…} & IStateTreeNode<…>) | { ...; }, opts?: { ...; } | undefined) => void
```

| Member                                                             | Type                                                                        |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| <span id="action-setdrawerposition">setDrawerPosition</span>       | `(arg: string) => void`                                                     |
| <span id="action-updatedrawerwidth">updateDrawerWidth</span>       | `(drawerWidth: number) => number`                                           |
| <span id="action-resizedrawer">resizeDrawer</span>                 | `(distance: number) => number`                                              |
| <span id="action-addwidget">addWidget</span>                       | `(typeName: string, id: string, initialState?: any, conf?: unknown) => any` |
| <span id="action-showwidget">showWidget</span>                     | `(widget: any) => void`                                                     |
| <span id="action-hidewidget">hideWidget</span>                     | `(widget: any) => void`                                                     |
| <span id="action-minimizewidgetdrawer">minimizeWidgetDrawer</span> | `() => void`                                                                |
| <span id="action-showwidgetdrawer">showWidgetDrawer</span>         | `() => void`                                                                |
| <span id="action-returnwidgettodrawer">returnWidgetToDrawer</span> | `() => void`                                                                |
| <span id="action-hideallwidgets">hideAllWidgets</span>             | `() => void`                                                                |

</details>

<details>
<summary>Derived from SessionTracksManagerSessionMixin</summary>

[SessionTracksManagerSessionMixin →](../sessiontracksmanagersessionmixin)

**Properties**

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

**Volatiles**

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

**Getters**

#### getter: tracks

User-added session tracks first, then each admin config track with its delta
(trackConfigDeltas) merged over it. A base track without a delta is returned
unchanged by identity to keep the hydration cache warm.

```ts
type tracks = (ModelInstanceTypeProps<…> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]
```

**Methods**

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

**Actions**

#### action: updateTrackConfiguration

Persist a non-admin's edited track config as a delta (trackConfigDeltas) against
the admin-owned base — only the changed slots — so the edits persist and are
shared while admin changes to untouched fields still flow through. A user-added
session track (no base) is edited in place. Everything else (admin edits, opened
connection tracks) defers to the base mixin, which routes connection tracks to
connectionTrackConfigs and the rest to the jbrowse config.

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

| Member                                                   | Type                                                                                     |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| <span id="action-addtrackconf">addTrackConf</span>       | `(trackConf: AnyConfiguration) => any`                                                   |
| <span id="action-deletetrackconf">deleteTrackConf</span> | `(trackConf: ModelInstanceTypeProps<…> & {…} & IStateTreeNode<…>) => any[] \| undefined` |

</details>

<details>
<summary>Derived from TracksManagerSessionMixin</summary>

[TracksManagerSessionMixin →](../tracksmanagersessionmixin)

**Methods**

#### method: getTrackById

Config for one trackId — a track, assembly sequence, or connection track — or
undefined. Per-id reactive: every display resolves its config through this (via
TrackConfigurationReference) and subscribes only to its own id, so one track's
settings edit doesn't re-render the others.

```ts
type getTrackById = (id: string) => (ModelInstanceTypeProps<…> & {…} & IStateTreeNode<…>) | undefined
```

| Member                                               | Type                                                                                                                                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| <span id="method-gettracksbyid">getTracksById</span> | `() => Record<string, ModelInstanceTypeProps<…> & { setSubschema(slotName: string, data: Record<…>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>>` |

</details>

<details>
<summary>Derived from AssembliesMixin</summary>

[AssembliesMixin →](../assembliesmixin)

**Properties**

| Member                                                             | Type                                                                  |
| ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| <span id="property-sessionassemblies">sessionAssemblies</span>     | `IOptionalIType<IArrayType<ConfigurationSchemaType<…>>, [undefined]>` |
| <span id="property-temporaryassemblies">temporaryAssemblies</span> | `IOptionalIType<IArrayType<ConfigurationSchemaType<…>>, [undefined]>` |

**Getters**

#### getter: assemblyNames

names of the assemblies returned by the `assemblies` getter

```ts
type assemblyNames = string[]
```

**Actions**

#### action: addTemporaryAssembly

used for read vs ref type assemblies.

```ts
type addTemporaryAssembly = (conf: AnyConfiguration) => ModelInstanceTypeProps<…> & {…} & IStateTreeNode<…>
```

| Member                                                                   | Type                                                                              |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| <span id="action-addsessionassembly">addSessionAssembly</span>           | `(conf: AnyConfiguration) => ModelInstanceTypeProps<…> & {…} & IStateTreeNode<…>` |
| <span id="action-addassembly">addAssembly</span>                         | `(conf: AnyConfiguration) => void`                                                |
| <span id="action-removeassembly">removeAssembly</span>                   | `(name: string) => void`                                                          |
| <span id="action-removesessionassembly">removeSessionAssembly</span>     | `(assemblyName: string) => void`                                                  |
| <span id="action-removetemporaryassembly">removeTemporaryAssembly</span> | `(name: string) => void`                                                          |

</details>

<details>
<summary>Derived from AppSessionMixin</summary>

[AppSessionMixin →](../appsessionmixin)

**Getters**

| Member                                                   | Type                                                                               |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| <span id="getter-version">version</span>                 | `string`                                                                           |
| <span id="getter-gitcommit">gitCommit</span>             | `string \| undefined`                                                              |
| <span id="getter-history">history</span>                 | `{ canUndo: boolean; canRedo: boolean; undo(): void; redo(): void; } \| undefined` |
| <span id="getter-assemblymanager">assemblyManager</span> | `ModelInstanceTypeProps<…> & {…} & {…} & {…} & {…} & IStateTreeNode<…>`            |

**Methods**

| Member                               | Type           |
| ------------------------------------ | -------------- |
| <span id="method-menus">menus</span> | `() => Menu[]` |

**Actions**

| Member                                                             | Type                            |
| ------------------------------------------------------------------ | ------------------------------- |
| <span id="action-renamecurrentsession">renameCurrentSession</span> | `(sessionName: string) => void` |

</details>

<details>
<summary>Derived from WebSessionConnectionsMixin</summary>

[WebSessionConnectionsMixin →](../websessionconnectionsmixin)

**Properties**

| Member                                                           | Type                                                     |
| ---------------------------------------------------------------- | -------------------------------------------------------- |
| <span id="property-sessionconnections">sessionConnections</span> | `IOptionalIType<IArrayType<IAnyModelType>, [undefined]>` |

**Actions**

| Member                                                       | Type                                                                                                                                                                                   |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <span id="action-addconnectionconf">addConnectionConf</span> | `(connectionConf: ModelInstanceTypeProps<…> & { setSubschema(slotName: string, data: Record<…>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<…>) => any`  |
| <span id="action-deleteconnection">deleteConnection</span>   | `(configuration: ModelInstanceTypeProps<…> & { setSubschema(slotName: string, data: Record<…>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => any` |

</details>

<details>
<summary>Derived from ConnectionManagementSessionMixin</summary>

[ConnectionManagementSessionMixin →](../connectionmanagementsessionmixin)

**Properties**

#### property: connectionTrackConfigs

Persisted configs of connection tracks the user has opened, keyed by trackId.
Unlike `connectionInstances` (stripped from snapshots, holds the whole fetched
hub), this holds only the tracks in use, so an open connection track resolves
synchronously on session load without re-establishing the connection.

```ts
// type signature
type connectionTrackConfigs = IOptionalIType<IType<Record<string, ConnectionTrackConfigEntry>, Record<string, ConnectionTrackConfigEntry>, Record<...>>, [...]>
// code
connectionTrackConfigs: types.stripDefault(
        types.frozen<Record<string, ConnectionTrackConfigEntry>>(),
        {},
      )
```

| Member                                                             | Type                                                |
| ------------------------------------------------------------------ | --------------------------------------------------- |
| <span id="property-connectioninstances">connectionInstances</span> | `IOptionalIType<IArrayType<IAnyType>, [undefined]>` |

**Actions**

#### action: breakConnection

Remove a live connection instance. Tolerant of an already-dormant connection
(its instance is stripped from the session on reload). Leaves persisted
open-track configs alone — the connect() error path calls this and the user's
already-open tracks must survive a transient failure. Full removal goes through
`deleteConnection`.

```ts
type breakConnection = (configuration: ModelInstanceTypeProps<…> & { setSubschema(slotName: string, data: Record<…>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<…>) => void
```

#### action: teardownConnection

Close every track a connection contributed — the live instance's tracks plus any
persisted open-track configs (a dormant connection, never expanded this session,
still renders its opened tracks from `connectionTrackConfigs`) — from all
views/widgets, drop the live instance, and drop the persisted configs. The
session is left as if the connection had never loaded.

```ts
type teardownConnection = (configuration: ModelInstanceTypeProps<…> & { setSubschema(slotName: string, data: Record<…>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<…>) => void
```

#### action: captureConnectionTrack

Snapshot a just-opened connection track's config into `connectionTrackConfigs`
so it survives session reload. No-op if the track isn't connection-provided or
is already captured (edits go through `updateConnectionTrackConfig`).

```ts
type captureConnectionTrack = (trackId: string) => void
```

#### action: updateConnectionTrackConfig

Persist an edit to an opened connection track. The full config is stored (not a
delta): the connection's fetched "base" isn't present at load, so only a
complete config resolves synchronously.

```ts
type updateConnectionTrackConfig = (
  trackConf: Record<string, unknown> & { trackId: string },
) => void
```

#### action: setConnectionTrackConfig

Upsert one opened connection track's persisted config.

```ts
type setConnectionTrackConfig = (
  trackId: string,
  connectionId: string,
  config: Record<string, unknown>,
) => void
```

#### action: pruneConnectionTrackConfig

Drop a connection track's persisted config once no open view still references
it, so the session doesn't accumulate closed tracks.

```ts
type pruneConnectionTrackConfig = (trackId: string) => void
```

#### action: hydrateConnection

Lazily establish a single connection by id if it isn't already live — used when
its category is expanded in the track selector. Fetches silently (no view launch
/ success snackbar); already-open tracks keep rendering from
`connectionTrackConfigs` meanwhile. Idempotent.

```ts
type hydrateConnection = (connectionId: string) => void
```

| Member                                                     | Type                                                                                                 |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| <span id="action-makeconnection">makeConnection</span>     | `(configuration: ModelInstanceTypeProps<…> & {…} & IStateTreeNode<…>, initialSnapshot?: any) => any` |
| <span id="action-clearconnections">clearConnections</span> | `() => void`                                                                                         |

</details>

<details>
<summary>Derived from DockviewLayoutMixin</summary>

[DockviewLayoutMixin →](../dockviewlayoutmixin)

**Properties**

#### property: dockviewLayout

Serialized dockview layout state

```ts
// type signature
type dockviewLayout = IOptionalIType<
  IMaybe<IType<SerializedDockview, SerializedDockview, SerializedDockview>>,
  [undefined]
>
// code
dockviewLayout: types.stripDefault(
  types.maybe(types.frozen<SerializedDockview>()),
  undefined,
)
```

#### property: panelViewAssignments

Maps panel IDs to arrays of view IDs (for stacking views within a panel)

```ts
// type signature
type panelViewAssignments = IOptionalIType<
  IMapType<IArrayType<ISimpleType<string>>>,
  [undefined]
>
// code
panelViewAssignments: types.stripDefault(
  types.map(types.array(types.string)),
  {},
)
```

#### property: activePanelId

The currently active panel ID in dockview

```ts
// type signature
type activePanelId = IOptionalIType<IMaybe<ISimpleType<string>>, [undefined]>
// code
activePanelId: types.stripDefault(types.maybe(types.string), undefined)
```

#### property: init

The initial nested layout to build dockview from (simple viewIds/ direction/size
form, vs. the verbose `dockviewLayout` dockview emits). Set from URL params
(spec layout) OR carried in a loaded session snapshot (e.g. the `encoded-`
session param), then consumed once when the dockview container mounts —
`createInitialPanels` reads it, `applyInitLayout` builds the panels, and it is
cleared to undefined (stripped from snapshots) so it never re-applies on a later
remount.

```ts
// type signature
type init = IOptionalIType<
  IMaybe<IType<DockviewLayoutNode, DockviewLayoutNode, DockviewLayoutNode>>,
  [undefined]
>
// code
init: types.stripDefault(
  types.maybe(types.frozen<DockviewLayoutNode>()),
  undefined,
)
```

**Volatiles**

| Member                                             | Type        |
| -------------------------------------------------- | ----------- |
| <span id="volatile-pendingmove">pendingMove</span> | `undefined` |

**Getters**

#### getter: getViewIdsForPanel

Get view IDs for a specific panel, as a plain snapshot array. Never the live MST
node: callers iterate this while removing views (which splices the underlying
array via the reconcile autorun), so leaking the live array would skip elements
mid-iteration. Mutators go through getPanelContainingView instead.

```ts
type getViewIdsForPanel = (panelId: string) => string[]
```

#### getter: getPanelContainingView

Find the panel containing a view, returning the panel ID, that panel's view-ID
list, and the view's index within it (or undefined if unassigned)

```ts
type getPanelContainingView = (viewId: string) =>
  | {
      panelId: string
      viewIds: IMSTArray<ISimpleType<string>> &
        IStateTreeNode<IArrayType<ISimpleType<string>>>
      idx: number
    }
  | undefined
```

**Actions**

#### action: setDockviewLayout

Save the current dockview layout

```ts
type setDockviewLayout = (layout: SerializedDockview | undefined) => void
```

#### action: setActivePanelId

Set the active panel ID

```ts
type setActivePanelId = (panelId: string | undefined) => void
```

#### action: setInit

Set the initial layout configuration (from URL params)

```ts
type setInit = (init: DockviewLayoutNode | undefined) => void
```

#### action: setPendingMove

Queue a view move to be applied when the dockview container mounts

```ts
type setPendingMove = (pendingMove: PendingMove | undefined) => void
```

#### action: assignViewToPanel

Assign a view to a panel (adds to the panel's view stack)

```ts
type assignViewToPanel = (panelId: string, viewId: string) => void
```

#### action: removeViewFromPanel

Remove a view from its panel

```ts
type removeViewFromPanel = (viewId: string) => void
```

#### action: removePanel

Remove a panel and all its view assignments

```ts
type removePanel = (panelId: string) => void
```

#### action: moveViewUpInPanel

Move a view up within its panel's view stack

```ts
type moveViewUpInPanel = (viewId: string) => void
```

#### action: moveViewDownInPanel

Move a view down within its panel's view stack

```ts
type moveViewDownInPanel = (viewId: string) => void
```

#### action: moveViewToTopInPanel

Move a view to the top of its panel's view stack

```ts
type moveViewToTopInPanel = (viewId: string) => void
```

#### action: moveViewToBottomInPanel

Move a view to the bottom of its panel's view stack

```ts
type moveViewToBottomInPanel = (viewId: string) => void
```

</details>

<details>
<summary>Derived from TrackMenuItemsSessionMixin</summary>

[TrackMenuItemsSessionMixin →](../trackmenuitemssessionmixin)

**Methods**

#### method: getTrackListMenuItems

flattened menu items for use in hierarchical track selector

```ts
type getTrackListMenuItems = (config: ModelInstanceTypeProps<…> & {…} & IStateTreeNode<…>, view?: TrackActionView | undefined) => MenuItem[]
```

#### method: getTrackActionMenuItems

track menu with About + "Track actions" submenu for the in-view label

```ts
type getTrackActionMenuItems = ({…}: { config: ModelInstanceTypeProps<…> & {…} & IStateTreeNode<…>; view?: TrackActionView | undefined; }) => MenuItem[]
```

</details>
