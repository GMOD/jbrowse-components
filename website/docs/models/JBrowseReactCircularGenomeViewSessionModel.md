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

| Member                                                             | Kind       | Defined by                                                              | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------ | ---------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [view](#property-view)                                             | Properties | JBrowseReactCircularGenomeViewSessionModel                              |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [version](#getter-version)                                         | Getters    | JBrowseReactCircularGenomeViewSessionModel                              |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [assemblyNames](#getter-assemblynames)                             | Getters    | JBrowseReactCircularGenomeViewSessionModel                              |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [assemblyManager](#getter-assemblymanager)                         | Getters    | JBrowseReactCircularGenomeViewSessionModel                              |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [views](#getter-views)                                             | Getters    | JBrowseReactCircularGenomeViewSessionModel                              |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [addView](#action-addview)                                         | Actions    | JBrowseReactCircularGenomeViewSessionModel                              | replaces view in this case                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [removeView](#action-removeview)                                   | Actions    | JBrowseReactCircularGenomeViewSessionModel                              | does nothing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [id](#property-id)                                                 | Properties | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [name](#property-name)                                             | Properties | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [margin](#property-margin)                                         | Properties | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [focusedViewId](#property-focusedviewid)                           | Properties | [BaseSessionModel](../basesessionmodel)                                 | used to keep track of which view is in focus                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [highlightsVisible](#property-highlightsvisible)                   | Properties | [BaseSessionModel](../basesessionmodel)                                 | one session-wide toggle for all region highlight bands (URL/view highlights and bookmark overlays)                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [selection](#volatile-selection)                                   | Volatiles  | [BaseSessionModel](../basesessionmodel)                                 | this is the globally "selected" object. can be anything. code that wants to deal with this should examine it to see what kind of thing it is.                                                                                                                                                                                                                                                                                                                                                                          |
| [hovered](#volatile-hovered)                                       | Volatiles  | [BaseSessionModel](../basesessionmodel)                                 | this is the globally "hovered" object. can be anything. code that wants to deal with this should examine it to see what kind of thing it is.                                                                                                                                                                                                                                                                                                                                                                           |
| [queueOfDialogs](#volatile-queueofdialogs)                         | Volatiles  | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [preferencesOverrides](#volatile-preferencesoverrides)             | Volatiles  | [BaseSessionModel](../basesessionmodel)                                 | runtime user-preference overrides keyed by preference id, resolved by `getPreference` against the `configuration.preferences` admin defaults. Empty here (config-only); products that let users edit preferences load and persist these via localStorage. A runtime override map layered over config defaults, kept off the snapshot since prefs are local UI.                                                                                                                                                         |
| [root](#getter-root)                                               | Getters    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [jbrowse](#getter-jbrowse)                                         | Getters    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [rpcManager](#getter-rpcmanager)                                   | Getters    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [configuration](#getter-configuration)                             | Getters    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [adminMode](#getter-adminmode)                                     | Getters    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [textSearchManager](#getter-textsearchmanager)                     | Getters    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [assemblies](#getter-assemblies)                                   | Getters    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [DialogComponent](#getter-dialogcomponent)                         | Getters    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [DialogProps](#getter-dialogprops)                                 | Getters    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [animationMode](#getter-animationmode)                             | Getters    | [BaseSessionModel](../basesessionmodel)                                 | resolved feature-layout animation mode (never undefined)                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [scrollZoom](#getter-scrollzoom)                                   | Getters    | [BaseSessionModel](../basesessionmodel)                                 | resolved scroll-to-zoom preference. Global and personal (never shared in a session snapshot); every wheel-zoom view reads this single value.                                                                                                                                                                                                                                                                                                                                                                           |
| [getPreference](#method-getpreference)                             | Methods    | [BaseSessionModel](../basesessionmodel)                                 | resolved value of a user preference: a runtime override if the user set one, otherwise the admin/embedder `configuration.preferences` default. The override map is empty unless the product loads it (web/desktop).                                                                                                                                                                                                                                                                                                    |
| [getDisplayTypeDefault](#method-getdisplaytypedefault)             | Methods    | [BaseSessionModel](../basesessionmodel)                                 | resolved value of a per-display-type slot default the user promoted (see `setDisplayTypeDefault`); undefined when nothing was promoted.                                                                                                                                                                                                                                                                                                                                                                                |
| [getPreferenceChanges](#method-getpreferencechanges)               | Methods    | [BaseSessionModel](../basesessionmodel)                                 | every runtime preference-override that currently differs from its config/admin default, as `{ path, from, to }` rows — the exact set `clearPreferenceOverrides` reverts. Backs the confirmation diff shown before "Reset to defaults" (mirrors the per-track changes dialog). A scalar pref (animationMode, scrollZoom) whose override equals the default is omitted (reverting it is a no-op); each promoted per-display-type default is always a difference from the un-promoted state, so `from` reads "(default)". |
| [setSelection](#action-setselection)                               | Actions    | [BaseSessionModel](../basesessionmodel)                                 | set the global selection, i.e. the globally-selected object. can be a feature, a view, just about anything                                                                                                                                                                                                                                                                                                                                                                                                             |
| [clearSelection](#action-clearselection)                           | Actions    | [BaseSessionModel](../basesessionmodel)                                 | clears the global selection                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [setHovered](#action-sethovered)                                   | Actions    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [setHighlightsVisible](#action-sethighlightsvisible)               | Actions    | [BaseSessionModel](../basesessionmodel)                                 | toggle all region highlight bands across every view                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [setPreferenceOverride](#action-setpreferenceoverride)             | Actions    | [BaseSessionModel](../basesessionmodel)                                 | set a runtime user-preference override (see `getPreference`). Mutates volatile state; products persist these to localStorage.                                                                                                                                                                                                                                                                                                                                                                                          |
| [clearPreferenceOverrides](#action-clearpreferenceoverrides)       | Actions    | [BaseSessionModel](../basesessionmodel)                                 | clear every runtime preference override at once — scrollZoom, animationMode, and every promoted per-display-type default (see `setDisplayTypeDefault`) — so each falls back to its config/admin default. Backs the Preferences dialog "Reset to defaults" button.                                                                                                                                                                                                                                                      |
| [clearPreferenceOverride](#action-clearpreferenceoverride)         | Actions    | [BaseSessionModel](../basesessionmodel)                                 | clear a single runtime preference override (see `getPreference`) so it falls back to its config/admin default. Backs the per-entry reset in the Preferences dialog "Reset to defaults" confirmation.                                                                                                                                                                                                                                                                                                                   |
| [setScrollZoom](#action-setscrollzoom)                             | Actions    | [BaseSessionModel](../basesessionmodel)                                 | set the global scroll-to-zoom preference (see the `scrollZoom` getter)                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setDisplayTypeDefault](#action-setdisplaytypedefault)             | Actions    | [BaseSessionModel](../basesessionmodel)                                 | promote (or, with `value` undefined, clear) a per-display-type slot default. Stored under `preferencesOverrides.displayTypeDefaults` so the PreferencesSessionMixin persists it to localStorage like other prefs.                                                                                                                                                                                                                                                                                                      |
| [setName](#action-setname)                                         | Actions    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [setFocusedViewId](#action-setfocusedviewid)                       | Actions    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [removeActiveDialog](#action-removeactivedialog)                   | Actions    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [queueDialog](#action-queuedialog)                                 | Actions    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [snackbarMessages](#volatile-snackbarmessages)                     | Volatiles  | [SnackbarModel](../snackbarmodel)                                       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [errorDialog](#volatile-errordialog)                               | Volatiles  | [SnackbarModel](../snackbarmodel)                                       | the error currently shown in the stack-trace dialog. Kept off the dialog queue so it can stack on top of an already-open dialog (e.g. the one whose action raised the error) instead of waiting behind it                                                                                                                                                                                                                                                                                                              |
| [snackbarMessageSet](#getter-snackbarmessageset)                   | Getters    | [SnackbarModel](../snackbarmodel)                                       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [notify](#action-notify)                                           | Actions    | [SnackbarModel](../snackbarmodel)                                       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [notifyError](#action-notifyerror)                                 | Actions    | [SnackbarModel](../snackbarmodel)                                       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [setErrorDialog](#action-seterrordialog)                           | Actions    | [SnackbarModel](../snackbarmodel)                                       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [pushSnackbarMessage](#action-pushsnackbarmessage)                 | Actions    | [SnackbarModel](../snackbarmodel)                                       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [popSnackbarMessage](#action-popsnackbarmessage)                   | Actions    | [SnackbarModel](../snackbarmodel)                                       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [removeSnackbarMessage](#action-removesnackbarmessage)             | Actions    | [SnackbarModel](../snackbarmodel)                                       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [drawerPosition](#property-drawerposition)                         | Properties | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [drawerWidth](#property-drawerwidth)                               | Properties | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [widgets](#property-widgets)                                       | Properties | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [activeWidgets](#property-activewidgets)                           | Properties | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [minimized](#property-minimized)                                   | Properties | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [visibleWidget](#getter-visiblewidget)                             | Getters    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [setDrawerPosition](#action-setdrawerposition)                     | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [updateDrawerWidth](#action-updatedrawerwidth)                     | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [resizeDrawer](#action-resizedrawer)                               | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [addWidget](#action-addwidget)                                     | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [showWidget](#action-showwidget)                                   | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [hideWidget](#action-hidewidget)                                   | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [minimizeWidgetDrawer](#action-minimizewidgetdrawer)               | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [showWidgetDrawer](#action-showwidgetdrawer)                       | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [hideAllWidgets](#action-hideallwidgets)                           | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [editConfiguration](#action-editconfiguration)                     | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 | opens a configuration editor to configure the given thing, and sets the current task to be configuring it                                                                                                                                                                                                                                                                                                                                                                                                              |
| [connectionInstances](#property-connectioninstances)               | Properties | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [connectionTrackConfigs](#property-connectiontrackconfigs)         | Properties | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Persisted configs of connection tracks the user has opened, keyed by trackId. Unlike `connectionInstances` (stripped from snapshots, holds the whole fetched hub), this holds only the tracks in use, so an open connection track resolves synchronously on session load without re-establishing the connection.                                                                                                                                                                                                       |
| [connections](#getter-connections)                                 | Getters    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [makeConnection](#action-makeconnection)                           | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [breakConnection](#action-breakconnection)                         | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Remove a live connection instance. Tolerant of an already-dormant connection (its instance is stripped from the session on reload). Leaves persisted open-track configs alone — the connect() error path calls this and the user's already-open tracks must survive a transient failure. Full removal goes through `deleteConnection`.                                                                                                                                                                                 |
| [teardownConnection](#action-teardownconnection)                   | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Close every track a connection contributed — the live instance's tracks plus any persisted open-track configs (a dormant connection, never expanded this session, still renders its opened tracks from `connectionTrackConfigs`) — from all views/widgets, drop the live instance, and drop the persisted configs. The session is left as if the connection had never loaded.                                                                                                                                          |
| [deleteConnection](#action-deleteconnection)                       | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Fully remove a connection: tear down its tracks and live instance, then delete its config.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [addConnectionConf](#action-addconnectionconf)                     | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [clearConnections](#action-clearconnections)                       | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [captureConnectionTrack](#action-captureconnectiontrack)           | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Snapshot a just-opened connection track's config into `connectionTrackConfigs` so it survives session reload. No-op if the track isn't connection-provided or is already captured (edits go through `updateConnectionTrackConfig`).                                                                                                                                                                                                                                                                                    |
| [updateConnectionTrackConfig](#action-updateconnectiontrackconfig) | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Persist an edit to an opened connection track. The full config is stored (not a delta): the connection's fetched "base" isn't present at load, so only a complete config resolves synchronously.                                                                                                                                                                                                                                                                                                                       |
| [setConnectionTrackConfig](#action-setconnectiontrackconfig)       | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Upsert one opened connection track's persisted config.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [pruneConnectionTrackConfig](#action-pruneconnectiontrackconfig)   | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Drop a connection track's persisted config once no open view still references it, so the session doesn't accumulate closed tracks.                                                                                                                                                                                                                                                                                                                                                                                     |
| [hydrateConnection](#action-hydrateconnection)                     | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Lazily establish a single connection by id if it isn't already live — used when its category is expanded in the track selector. Fetches silently (no view launch / success snackbar); already-open tracks keep rendering from `connectionTrackConfigs` meanwhile. Idempotent.                                                                                                                                                                                                                                          |
| [tracksByIdMap](#volatile-tracksbyidmap)                           | Volatiles  | [TracksManagerSessionMixin](../tracksmanagersessionmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [tracks](#getter-tracks)                                           | Getters    | [TracksManagerSessionMixin](../tracksmanagersessionmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [getTracksById](#getter-gettracksbyid)                             | Getters    | [TracksManagerSessionMixin](../tracksmanagersessionmixin)               | Map of trackId → config for all tracks, assemblies, and connections. Frozen jbrowse.tracks are returned as plain objects here; hydration to MST models happens lazily in TrackConfigurationReference on first access. MobX caches this until any dependency changes.                                                                                                                                                                                                                                                   |
| [tracksById](#getter-tracksbyid)                                   | Getters    | [TracksManagerSessionMixin](../tracksmanagersessionmixin)               | Stable, per-entry-observable map of trackId → config for all tracks, assemblies, and connections. Reading `.get(id)` subscribes only to that entry, so editing one track no longer invalidates every consumer (see `tracksByIdMap`). Kept current by the reconcile autorun below.                                                                                                                                                                                                                                      |
| [applyTracksById](#action-applytracksbyid)                         | Actions    | [TracksManagerSessionMixin](../tracksmanagersessionmixin)               | Reconcile `tracksByIdMap` to the given trackId → config snapshot: set new/changed entries, drop removed ones. Mutation only — the tracked read of `getTracksById()` happens in the driving autorun, NOT here, because a MobX action untracks its reads (so reading the sources here would leave the autorun with no dependencies and it would never re-fire). `set` on an unchanged (identity-equal) entry doesn't notify, so only genuinely-changed tracks wake their observers.                                      |
| [addTrackConf](#action-addtrackconf)                               | Actions    | [TracksManagerSessionMixin](../tracksmanagersessionmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [updateTrackConfiguration](#action-updatetrackconfiguration)       | Actions    | [TracksManagerSessionMixin](../tracksmanagersessionmixin)               | Persist edited track config back to the in-memory jbrowse config. The session-tracks mixin overrides this so a non-admin's edits become a shareable session-track override instead.                                                                                                                                                                                                                                                                                                                                    |
| [deleteTrackConf](#action-deletetrackconf)                         | Actions    | [TracksManagerSessionMixin](../tracksmanagersessionmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [getReferringMultiple](#method-getreferringmultiple)               | Methods    | [ReferenceManagementSessionMixin](../referencemanagementsessionmixin)   | Walk the tree once and map each requested trackId to the nodes holding a `types.reference` that resolves to it (a view's track entry, a config editor widget). Track configs are matched by trackId, not identity, so a frozen base and its hydrated MST node compare equal.                                                                                                                                                                                                                                           |
| [getReferring](#method-getreferring)                               | Methods    | [ReferenceManagementSessionMixin](../referencemanagementsessionmixin)   | The nodes currently referring to `trackId` (see getReferringMultiple).                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [dereferenceTrack](#action-dereferencetrack)                       | Actions    | [ReferenceManagementSessionMixin](../referencemanagementsessionmixin)   | Remove `trackId` from every view referring to it and close any config editor widget open on it. Runs immediately: the walk that produced `referring` has finished, so mutating those views here is safe.                                                                                                                                                                                                                                                                                                               |
| [getTrackListMenuItems](#method-gettracklistmenuitems)             | Methods    | [TrackMenuSessionMixin](../trackmenusessionmixin)                       | flattened menu items for use in hierarchical track selector                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [getTrackActionMenuItems](#method-gettrackactionmenuitems)         | Methods    | [TrackMenuSessionMixin](../trackmenusessionmixin)                       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [themeOptions](#getter-themeoptions)                               | Getters    | [EmbeddedSessionThemeMixin](../embeddedsessionthememixin)               | Serializable theme description (the canonical `themeOptions` contract shared with the app-core/web sessions). This is what crosses the RPC worker boundary — e.g. the canvas display reads `getSession(self).themeOptions` in its rpcProps so worker-baked colors (CDS frames, stroke fallback) honor the config `theme` slot.                                                                                                                                                                                         |
| [theme](#getter-theme)                                             | Getters    | [EmbeddedSessionThemeMixin](../embeddedsessionthememixin)               | Resolved MUI theme, mirroring the product's ThemeProvider. Lets headless/RPC consumers derive theme-dependent state without a mounted component.                                                                                                                                                                                                                                                                                                                                                                       |

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

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from BaseSessionModel</summary>

[BaseSessionModel →](../basesessionmodel)

**Properties**

#### property: id

```ts
// type signature
type id = IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: name

```ts
// type signature
type name = ISimpleType<string>
// code
name: types.string
```

#### property: margin

```ts
// type signature
type margin = IOptionalIType<ISimpleType<number>, [undefined]>
// code
margin: types.stripDefault(types.number, 0)
```

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

#### volatile: queueOfDialogs

```ts
// type signature
type queueOfDialogs = [DialogComponentType, Record<string, unknown>][]
// code
queueOfDialogs: [] as [DialogComponentType, Record<string, unknown>][]
```

#### volatile: preferencesOverrides

runtime user-preference overrides keyed by preference id, resolved by
`getPreference` against the `configuration.preferences` admin defaults. Empty
here (config-only); products that let users edit preferences load and persist
these via localStorage. A runtime override map layered over config defaults,
kept off the snapshot since prefs are local UI.

```ts
// type signature
type preferencesOverrides = Record<string, unknown>
// code
preferencesOverrides: {} as Record<string, unknown>
```

**Getters**

#### getter: root

```ts
type root = TypeOrStateTreeNodeToStateTreeNode<ROOT_MODEL_TYPE>
```

#### getter: jbrowse

```ts
type jbrowse = any
```

#### getter: rpcManager

```ts
type rpcManager = RpcManager
```

#### getter: configuration

```ts
type configuration = Instance<JB_CONFIG_SCHEMA>
```

#### getter: adminMode

```ts
type adminMode = boolean
```

#### getter: textSearchManager

```ts
type textSearchManager = TextSearchManager
```

#### getter: assemblies

```ts
type assemblies = (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]
```

#### getter: DialogComponent

```ts
type DialogComponent = DialogComponentType
```

#### getter: DialogProps

```ts
type DialogProps = Record<string, unknown>
```

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

#### action: setHovered

```ts
type setHovered = (thing: unknown) => void
```

#### action: setHighlightsVisible

toggle all region highlight bands across every view

```ts
type setHighlightsVisible = (arg: boolean) => void
```

#### action: setPreferenceOverride

set a runtime user-preference override (see `getPreference`). Mutates volatile
state; products persist these to localStorage.

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
Stored under `preferencesOverrides.displayTypeDefaults` so the
PreferencesSessionMixin persists it to localStorage like other prefs.

```ts
type setDisplayTypeDefault = (
  displayType: string,
  slot: string,
  value: unknown,
) => void
```

#### action: setName

```ts
type setName = (str: string) => void
```

#### action: setFocusedViewId

```ts
type setFocusedViewId = (viewId: string) => void
```

#### action: removeActiveDialog

```ts
type removeActiveDialog = () => void
```

#### action: queueDialog

```ts
type queueDialog = (doneCallback: DoneCallback) => void
```

</details>

<details>
<summary>Derived from SnackbarModel</summary>

[SnackbarModel →](../snackbarmodel)

**Volatiles**

#### volatile: snackbarMessages

```ts
// type signature
type snackbarMessages = IObservableArray<SnackbarMessage>
// code
snackbarMessages: observable.array<SnackbarMessage>()
```

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

**Getters**

#### getter: snackbarMessageSet

```ts
type snackbarMessageSet = Map<string, SnackbarMessage>
```

**Actions**

#### action: notify

```ts
type notify = (
  message: string,
  level?: NotificationLevel | undefined,
  action?: SnackAction | SnackAction[] | undefined,
) => void
```

#### action: notifyError

```ts
type notifyError = (
  errorMessage: string,
  error?: unknown,
  extra?: unknown,
  action?: SnackAction | undefined,
) => void
```

#### action: setErrorDialog

```ts
type setErrorDialog = (state: ErrorDialogState | undefined) => void
```

#### action: pushSnackbarMessage

```ts
type pushSnackbarMessage = (
  message: string,
  level?: NotificationLevel | undefined,
  actions?: SnackAction[] | undefined,
) => void
```

#### action: popSnackbarMessage

```ts
type popSnackbarMessage = () => SnackbarMessage | undefined
```

#### action: removeSnackbarMessage

```ts
type removeSnackbarMessage = (message: string) => void
```

</details>

<details>
<summary>Derived from DrawerWidgetSessionMixin</summary>

[DrawerWidgetSessionMixin →](../drawerwidgetsessionmixin)

**Properties**

#### property: drawerPosition

```ts
// type signature
type drawerPosition = IOptionalIType<ISimpleType<string>, [undefined]>
// code
drawerPosition: types.optional(
  types.string,
  () => localStorageGetItem('drawerPosition') ?? 'right',
)
```

#### property: drawerWidth

```ts
// type signature
type drawerWidth = IOptionalIType<ISimpleType<number>, [undefined]>
// code
drawerWidth: types.stripDefault(
  types.refinement(types.integer, width => width >= minDrawerWidth),
  384,
)
```

#### property: widgets

```ts
// type signature
type widgets = IOptionalIType<IMapType<IAnyType>, [undefined]>
// code
widgets: types.stripDefault(types.map(widgetStateModelType), {})
```

#### property: activeWidgets

```ts
// type signature
type activeWidgets = IOptionalIType<
  IMapType<IMaybe<IReferenceType<IAnyType>>>,
  [undefined]
>
// code
activeWidgets: types.stripDefault(
  types.map(types.safeReference(widgetStateModelType)),
  {},
)
```

#### property: minimized

```ts
// type signature
type minimized = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
minimized: types.stripDefault(types.boolean, false)
```

**Getters**

#### getter: visibleWidget

```ts
type visibleWidget = any
```

**Actions**

#### action: setDrawerPosition

```ts
type setDrawerPosition = (arg: string) => void
```

#### action: updateDrawerWidth

```ts
type updateDrawerWidth = (drawerWidth: number) => number
```

#### action: resizeDrawer

```ts
type resizeDrawer = (distance: number) => number
```

#### action: addWidget

```ts
type addWidget = (
  typeName: string,
  id: string,
  initialState?: any,
  conf?: unknown,
) => any
```

#### action: showWidget

```ts
type showWidget = (widget: any) => void
```

#### action: hideWidget

```ts
type hideWidget = (widget: any) => void
```

#### action: minimizeWidgetDrawer

```ts
type minimizeWidgetDrawer = () => void
```

#### action: showWidgetDrawer

```ts
type showWidgetDrawer = () => void
```

#### action: hideAllWidgets

```ts
type hideAllWidgets = () => void
```

#### action: editConfiguration

opens a configuration editor to configure the given thing, and sets the current
task to be configuring it

```ts
type editConfiguration = (configuration: (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) | { ...; }, opts?: { ...; } | undefined) => void
```

</details>

<details>
<summary>Derived from ConnectionManagementSessionMixin</summary>

[ConnectionManagementSessionMixin →](../connectionmanagementsessionmixin)

**Properties**

#### property: connectionInstances

```ts
// type signature
type connectionInstances = IOptionalIType<IArrayType<IAnyType>, [undefined]>
// code
connectionInstances: types.stripDefault(
  types.array(pluginManager.pluggableMstType('connection', 'stateModel')),
  [],
)
```

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

**Getters**

#### getter: connections

```ts
type connections = (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]
```

**Actions**

#### action: makeConnection

```ts
type makeConnection = (configuration: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>, initialSnapshot?: any) => any
```

#### action: breakConnection

Remove a live connection instance. Tolerant of an already-dormant connection
(its instance is stripped from the session on reload). Leaves persisted
open-track configs alone — the connect() error path calls this and the user's
already-open tracks must survive a transient failure. Full removal goes through
`deleteConnection`.

```ts
type breakConnection = (configuration: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => void
```

#### action: teardownConnection

Close every track a connection contributed — the live instance's tracks plus any
persisted open-track configs (a dormant connection, never expanded this session,
still renders its opened tracks from `connectionTrackConfigs`) — from all
views/widgets, drop the live instance, and drop the persisted configs. The
session is left as if the connection had never loaded.

```ts
type teardownConnection = (configuration: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => void
```

#### action: deleteConnection

Fully remove a connection: tear down its tracks and live instance, then delete
its config.

```ts
type deleteConnection = (configuration: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => any
```

#### action: addConnectionConf

```ts
type addConnectionConf = (connectionConf: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => any
```

#### action: clearConnections

```ts
type clearConnections = () => void
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

</details>

<details>
<summary>Derived from TracksManagerSessionMixin</summary>

[TracksManagerSessionMixin →](../tracksmanagersessionmixin)

**Volatiles**

#### volatile: tracksByIdMap

```ts
// type signature
type tracksByIdMap = ObservableMap<string, ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>>
// code
tracksByIdMap: observable.map<string, AnyConfigurationModel>(undefined, {
        deep: false,
      })
```

**Getters**

#### getter: tracks

```ts
type tracks = (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]
```

#### getter: getTracksById

Map of trackId → config for all tracks, assemblies, and connections. Frozen
jbrowse.tracks are returned as plain objects here; hydration to MST models
happens lazily in TrackConfigurationReference on first access. MobX caches this
until any dependency changes.

```ts
type getTracksById = () => Record<string, ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>>
```

#### getter: tracksById

Stable, per-entry-observable map of trackId → config for all tracks, assemblies,
and connections. Reading `.get(id)` subscribes only to that entry, so editing
one track no longer invalidates every consumer (see `tracksByIdMap`). Kept
current by the reconcile autorun below.

```ts
type tracksById = ObservableMap<string, ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>>
```

**Actions**

#### action: applyTracksById

Reconcile `tracksByIdMap` to the given trackId → config snapshot: set
new/changed entries, drop removed ones. Mutation only — the tracked read of
`getTracksById()` happens in the driving autorun, NOT here, because a MobX
action untracks its reads (so reading the sources here would leave the autorun
with no dependencies and it would never re-fire). `set` on an unchanged
(identity-equal) entry doesn't notify, so only genuinely-changed tracks wake
their observers.

```ts
type applyTracksById = (desired: Record<string, ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>>) => void
```

#### action: addTrackConf

```ts
type addTrackConf = (trackConf: AnyConfiguration) => any
```

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

#### action: deleteTrackConf

```ts
type deleteTrackConf = (trackConf: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => any
```

</details>

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
<summary>Derived from TrackMenuSessionMixin</summary>

[TrackMenuSessionMixin →](../trackmenusessionmixin)

**Methods**

#### method: getTrackListMenuItems

flattened menu items for use in hierarchical track selector

```ts
type getTrackListMenuItems = (config: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>, view?: TrackActionView | undefined) => MenuItem[]
```

#### method: getTrackActionMenuItems

```ts
type getTrackActionMenuItems = ({ config, view, }: { config: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>; view?: TrackActionView | undefined; }) => MenuItem[]
```

</details>

<details>
<summary>Derived from EmbeddedSessionThemeMixin</summary>

[EmbeddedSessionThemeMixin →](../embeddedsessionthememixin)

**Getters**

#### getter: themeOptions

Serializable theme description (the canonical `themeOptions` contract shared
with the app-core/web sessions). This is what crosses the RPC worker boundary —
e.g. the canvas display reads `getSession(self).themeOptions` in its rpcProps so
worker-baked colors (CDS frames, stroke fallback) honor the config `theme` slot.

```ts
type themeOptions = SerializableThemeArgs
```

#### getter: theme

Resolved MUI theme, mirroring the product's ThemeProvider. Lets headless/RPC
consumers derive theme-dependent state without a mounted component.

```ts
type theme = Theme
```

</details>
