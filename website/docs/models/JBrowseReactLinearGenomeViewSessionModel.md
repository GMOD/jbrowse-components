---
id: jbrowsereactlineargenomeviewsessionmodel
title: JBrowseReactLinearGenomeViewSessionModel
sidebar_label: Session -> JBrowseReactLinearGenomeViewSessionModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/src/createModel/createSessionModel.ts).

## Overview

## Members

| Member                                                             | Kind       | Defined by                                                              | Description                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------ | ---------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [view](#property-view)                                             | Properties | JBrowseReactLinearGenomeViewSessionModel                                |                                                                                                                                                                                                                                                                                                                    |
| [version](#getter-version)                                         | Getters    | JBrowseReactLinearGenomeViewSessionModel                                |                                                                                                                                                                                                                                                                                                                    |
| [disableAddTracks](#getter-disableaddtracks)                       | Getters    | JBrowseReactLinearGenomeViewSessionModel                                |                                                                                                                                                                                                                                                                                                                    |
| [assemblyNames](#getter-assemblynames)                             | Getters    | JBrowseReactLinearGenomeViewSessionModel                                |                                                                                                                                                                                                                                                                                                                    |
| [assemblyManager](#getter-assemblymanager)                         | Getters    | JBrowseReactLinearGenomeViewSessionModel                                |                                                                                                                                                                                                                                                                                                                    |
| [views](#getter-views)                                             | Getters    | JBrowseReactLinearGenomeViewSessionModel                                |                                                                                                                                                                                                                                                                                                                    |
| [addView](#action-addview)                                         | Actions    | JBrowseReactLinearGenomeViewSessionModel                                |                                                                                                                                                                                                                                                                                                                    |
| [removeView](#action-removeview)                                   | Actions    | JBrowseReactLinearGenomeViewSessionModel                                |                                                                                                                                                                                                                                                                                                                    |
| [id](#property-id)                                                 | Properties | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                    |
| [name](#property-name)                                             | Properties | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                    |
| [margin](#property-margin)                                         | Properties | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                    |
| [focusedViewId](#property-focusedviewid)                           | Properties | [BaseSessionModel](../basesessionmodel)                                 | used to keep track of which view is in focus                                                                                                                                                                                                                                                                       |
| [highlightsVisible](#property-highlightsvisible)                   | Properties | [BaseSessionModel](../basesessionmodel)                                 | one session-wide toggle for all region highlight bands (URL/view highlights and bookmark overlays)                                                                                                                                                                                                                 |
| [selection](#volatile-selection)                                   | Volatiles  | [BaseSessionModel](../basesessionmodel)                                 | this is the globally "selected" object.                                                                                                                                                                                                                                                                            |
| [hovered](#volatile-hovered)                                       | Volatiles  | [BaseSessionModel](../basesessionmodel)                                 | this is the globally "hovered" object.                                                                                                                                                                                                                                                                             |
| [queueOfDialogs](#volatile-queueofdialogs)                         | Volatiles  | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                    |
| [preferencesOverrides](#volatile-preferencesoverrides)             | Volatiles  | [BaseSessionModel](../basesessionmodel)                                 | runtime user-preference overrides keyed by preference id, resolved by `getPreference` against the `configuration.preferences` admin defaults.                                                                                                                                                                      |
| [root](#getter-root)                                               | Getters    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                    |
| [jbrowse](#getter-jbrowse)                                         | Getters    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                    |
| [rpcManager](#getter-rpcmanager)                                   | Getters    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                    |
| [configuration](#getter-configuration)                             | Getters    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                    |
| [adminMode](#getter-adminmode)                                     | Getters    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                    |
| [textSearchManager](#getter-textsearchmanager)                     | Getters    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                    |
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
| [connectionInstances](#property-connectioninstances)               | Properties | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) |                                                                                                                                                                                                                                                                                                                    |
| [connectionTrackConfigs](#property-connectiontrackconfigs)         | Properties | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Persisted configs of connection tracks the user has opened, keyed by trackId.                                                                                                                                                                                                                                      |
| [connections](#getter-connections)                                 | Getters    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) |                                                                                                                                                                                                                                                                                                                    |
| [makeConnection](#action-makeconnection)                           | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) |                                                                                                                                                                                                                                                                                                                    |
| [breakConnection](#action-breakconnection)                         | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Remove a live connection instance.                                                                                                                                                                                                                                                                                 |
| [teardownConnection](#action-teardownconnection)                   | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Close every track a connection contributed — the live instance's tracks plus any persisted open-track configs (a dormant connection, never expanded this session, still renders its opened tracks from `connectionTrackConfigs`) — from all views/widgets, drop the live instance, and drop the persisted configs. |
| [deleteConnection](#action-deleteconnection)                       | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Fully remove a connection: tear down its tracks and live instance, then delete its config.                                                                                                                                                                                                                         |
| [addConnectionConf](#action-addconnectionconf)                     | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) |                                                                                                                                                                                                                                                                                                                    |
| [clearConnections](#action-clearconnections)                       | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) |                                                                                                                                                                                                                                                                                                                    |
| [captureConnectionTrack](#action-captureconnectiontrack)           | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Snapshot a just-opened connection track's config into `connectionTrackConfigs` so it survives session reload.                                                                                                                                                                                                      |
| [updateConnectionTrackConfig](#action-updateconnectiontrackconfig) | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Persist an edit to an opened connection track.                                                                                                                                                                                                                                                                     |
| [setConnectionTrackConfig](#action-setconnectiontrackconfig)       | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Upsert one opened connection track's persisted config.                                                                                                                                                                                                                                                             |
| [pruneConnectionTrackConfig](#action-pruneconnectiontrackconfig)   | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Drop a connection track's persisted config once no open view still references it, so the session doesn't accumulate closed tracks.                                                                                                                                                                                 |
| [hydrateConnection](#action-hydrateconnection)                     | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Lazily establish a single connection by id if it isn't already live — used when its category is expanded in the track selector.                                                                                                                                                                                    |
| [getReferringMultiple](#method-getreferringmultiple)               | Methods    | [ReferenceManagementSessionMixin](../referencemanagementsessionmixin)   | Walk the tree once and map each requested trackId to the nodes holding a `types.reference` that resolves to it (a view's track entry, a config editor widget).                                                                                                                                                     |
| [getReferring](#method-getreferring)                               | Methods    | [ReferenceManagementSessionMixin](../referencemanagementsessionmixin)   | The nodes currently referring to `trackId` (see getReferringMultiple).                                                                                                                                                                                                                                             |
| [dereferenceTrack](#action-dereferencetrack)                       | Actions    | [ReferenceManagementSessionMixin](../referencemanagementsessionmixin)   | Remove `trackId` from every view referring to it and close any config editor widget open on it.                                                                                                                                                                                                                    |
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
| [getTrackListMenuItems](#method-gettracklistmenuitems)             | Methods    | [TrackMenuSessionMixin](../trackmenusessionmixin)                       | flattened menu items for use in hierarchical track selector                                                                                                                                                                                                                                                        |
| [getTrackActionMenuItems](#method-gettrackactionmenuitems)         | Methods    | [TrackMenuSessionMixin](../trackmenusessionmixin)                       |                                                                                                                                                                                                                                                                                                                    |
| [themeOptions](#getter-themeoptions)                               | Getters    | [EmbeddedSessionThemeMixin](../embeddedsessionthememixin)               | Serializable theme description (the canonical `themeOptions` contract shared with the app-core/web sessions).                                                                                                                                                                                                      |
| [theme](#getter-theme)                                             | Getters    | [EmbeddedSessionThemeMixin](../embeddedsessionthememixin)               | Resolved MUI theme, mirroring the product's ThemeProvider.                                                                                                                                                                                                                                                         |

<details>
<summary>JBrowseReactLinearGenomeViewSessionModel - Properties</summary>

| Member                               | Type                                                                                                                       |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| <span id="property-view">view</span> | `IModelType<_OverrideProps<_OverrideProps<…>, { ...; }>, { ...; } & ... 19 more ... & { ...; }, _NotCustomized, { ...; }>` |

</details>

<details>
<summary>JBrowseReactLinearGenomeViewSessionModel - Getters</summary>

| Member                                                     | Type                                                                                                              |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| <span id="getter-version">version</span>                   | `string`                                                                                                          |
| <span id="getter-disableaddtracks">disableAddTracks</span> | `boolean`                                                                                                         |
| <span id="getter-assemblynames">assemblyNames</span>       | `string[]`                                                                                                        |
| <span id="getter-assemblymanager">assemblyManager</span>   | `ModelInstanceTypeProps<…> & {…} & {…} & {…} & {…} & IStateTreeNode<…>`                                           |
| <span id="getter-views">views</span>                       | `(ModelInstanceTypeProps<_OverrideProps<_OverrideProps<…>, { ...; }>> & ... 21 more ... & IStateTreeNode<...>)[]` |

</details>

<details>
<summary>JBrowseReactLinearGenomeViewSessionModel - Actions</summary>

| Member                                         | Type                                                                                                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <span id="action-addview">addView</span>       | `(typeName: string, initialState?: any) => ModelInstanceTypeProps<_OverrideProps<_OverrideProps<…>, { ...; }>> & ... 21 more ... & IStateTreeNode<...>` |
| <span id="action-removeview">removeView</span> | `() => void`                                                                                                                                            |

</details>

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

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

| Member                                                       | Type                                                                                                                                                                             |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <span id="getter-root">root</span>                           | `TypeOrStateTreeNodeToStateTreeNode<ROOT_MODEL_TYPE>`                                                                                                                            |
| <span id="getter-jbrowse">jbrowse</span>                     | `any`                                                                                                                                                                            |
| <span id="getter-rpcmanager">rpcManager</span>               | `RpcManager`                                                                                                                                                                     |
| <span id="getter-configuration">configuration</span>         | `Instance<JB_CONFIG_SCHEMA>`                                                                                                                                                     |
| <span id="getter-adminmode">adminMode</span>                 | `boolean`                                                                                                                                                                        |
| <span id="getter-textsearchmanager">textSearchManager</span> | `TextSearchManager`                                                                                                                                                              |
| <span id="getter-assemblies">assemblies</span>               | `(ModelInstanceTypeProps<…> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]` |
| <span id="getter-dialogcomponent">DialogComponent</span>     | `DialogComponentType`                                                                                                                                                            |
| <span id="getter-dialogprops">DialogProps</span>             | `Record<string, unknown>`                                                                                                                                                        |

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

**Getters**

| Member                                           | Type                                                                                                                                                                             |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <span id="getter-connections">connections</span> | `(ModelInstanceTypeProps<…> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]` |

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

#### action: deleteConnection

Fully remove a connection: tear down its tracks and live instance, then delete
its config.

```ts
type deleteConnection = (configuration: ModelInstanceTypeProps<…> & { setSubschema(slotName: string, data: Record<…>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => any
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

| Member                                                       | Type                                                                                                                                                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <span id="action-makeconnection">makeConnection</span>       | `(configuration: ModelInstanceTypeProps<…> & {…} & IStateTreeNode<…>, initialSnapshot?: any) => any`                                                                                  |
| <span id="action-addconnectionconf">addConnectionConf</span> | `(connectionConf: ModelInstanceTypeProps<…> & { setSubschema(slotName: string, data: Record<…>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<…>) => any` |
| <span id="action-clearconnections">clearConnections</span>   | `() => void`                                                                                                                                                                          |

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
<summary>Derived from TrackMenuSessionMixin</summary>

[TrackMenuSessionMixin →](../trackmenusessionmixin)

**Methods**

#### method: getTrackListMenuItems

flattened menu items for use in hierarchical track selector

```ts
type getTrackListMenuItems = (config: ModelInstanceTypeProps<…> & {…} & IStateTreeNode<…>, view?: TrackActionView | undefined) => MenuItem[]
```

| Member                                                                   | Type                                                                                                                         |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| <span id="method-gettrackactionmenuitems">getTrackActionMenuItems</span> | `({…}: { config: ModelInstanceTypeProps<…> & {…} & IStateTreeNode<…>; view?: TrackActionView \| undefined; }) => MenuItem[]` |

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
