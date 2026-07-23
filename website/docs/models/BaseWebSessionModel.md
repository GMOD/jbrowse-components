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

| Member                                                             | Kind       | Defined by                                                              | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------ | ---------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [sessionPlugins](#property-sessionplugins)                         | Properties | BaseWebSessionModel                                                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [sessionThemeName](#volatile-sessionthemename)                     | Volatiles  | BaseWebSessionModel                                                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [pendingFileHandleIds](#volatile-pendingfilehandleids)             | Volatiles  | BaseWebSessionModel                                                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [root](#getter-root)                                               | Getters    | BaseWebSessionModel                                                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [connections](#getter-connections)                                 | Getters    | BaseWebSessionModel                                                     | list of config connections and session connections                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [shareURL](#getter-shareurl)                                       | Getters    | BaseWebSessionModel                                                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [textSearchManager](#getter-textsearchmanager)                     | Getters    | BaseWebSessionModel                                                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [canEditTrack](#method-canedittrack)                               | Methods    | BaseWebSessionModel                                                     | whether the user may edit this track's config (admins may edit any; everyone else only their own session tracks)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [isTrackOverride](#method-istrackoverride)                         | Methods    | BaseWebSessionModel                                                     | whether `trackId` has a non-admin config override (a delta stored in trackConfigDeltas against an admin-owned config track, see updateTrackConfiguration), rather than a standalone user-added session track. Drives the "Reset track settings" menu swap and the edited badge.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [getTrackActions](#method-gettrackactions)                         | Methods    | BaseWebSessionModel                                                     | raw track actions (Settings, Copy, Delete) without submenu wrapper                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [addAssemblyConf](#action-addassemblyconf)                         | Actions    | BaseWebSessionModel                                                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [addSessionPlugin](#action-addsessionplugin)                       | Actions    | BaseWebSessionModel                                                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [removeSessionPlugin](#action-removesessionplugin)                 | Actions    | BaseWebSessionModel                                                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setDefaultSession](#action-setdefaultsession)                     | Actions    | BaseWebSessionModel                                                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setSession](#action-setsession)                                   | Actions    | BaseWebSessionModel                                                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [editTrackConfiguration](#action-edittrackconfiguration)           | Actions    | BaseWebSessionModel                                                     | opens the config editor for a track. Available for any track: a non-admin's edits to an admin-owned track persist as a delta (trackConfigDeltas) that rides along in the shared/saved session, rather than mutating the admin-owned config itself.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [setPendingFileHandleIds](#action-setpendingfilehandleids)         | Actions    | BaseWebSessionModel                                                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [getReferringMultiple](#method-getreferringmultiple)               | Methods    | [ReferenceManagementSessionMixin](../referencemanagementsessionmixin)   | Walk the tree once and map each requested trackId to the nodes holding a `types.reference` that resolves to it (a view's track entry, a config editor widget). Track configs are matched by trackId, not identity, so a frozen base and its hydrated MST node compare equal.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [getReferring](#method-getreferring)                               | Methods    | [ReferenceManagementSessionMixin](../referencemanagementsessionmixin)   | The nodes currently referring to `trackId` (see getReferringMultiple).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [dereferenceTrack](#action-dereferencetrack)                       | Actions    | [ReferenceManagementSessionMixin](../referencemanagementsessionmixin)   | Remove `trackId` from every view referring to it and close any config editor widget open on it. Runs immediately: the walk that produced `referring` has finished, so mutating those views here is safe.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [themeName](#getter-themename)                                     | Getters    | [ThemeManagerSessionMixin](../thememanagersessionmixin)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [themeOptions](#getter-themeoptions)                               | Getters    | [ThemeManagerSessionMixin](../thememanagersessionmixin)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [theme](#getter-theme)                                             | Getters    | [ThemeManagerSessionMixin](../thememanagersessionmixin)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [allThemes](#method-allthemes)                                     | Methods    | [ThemeManagerSessionMixin](../thememanagersessionmixin)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [getActiveThemeOptions](#method-getactivethemeoptions)             | Methods    | [ThemeManagerSessionMixin](../thememanagersessionmixin)                 | Raw `ThemeOptions` for the active theme, or a named override (used by the SVG-export theme picker). Unlike `theme` (a built, non-serializable MUI theme), this is the plain options object every view's SVG export threads into each display's `renderSvg`, which rebuilds the theme via `createJBrowseTheme` outside React context.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [setThemeName](#action-setthemename)                               | Actions    | [ThemeManagerSessionMixin](../thememanagersessionmixin)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [views](#property-views)                                           | Properties | [MultipleViewsSessionMixin](../multipleviewssessionmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [stickyViewHeaders](#property-stickyviewheaders)                   | Properties | [MultipleViewsSessionMixin](../multipleviewssessionmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [useWorkspaces](#property-useworkspaces)                           | Properties | [MultipleViewsSessionMixin](../multipleviewssessionmixin)               | enables the dockview-based tabbed/tiled workspace layout for this session. Undefined means unspecified — read `effectiveUseWorkspaces`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [effectiveUseWorkspaces](#getter-effectiveuseworkspaces)           | Getters    | [MultipleViewsSessionMixin](../multipleviewssessionmixin)               | resolved workspaces flag (never undefined): this session's value, else the user preference over the `configuration.preferences.useWorkspaces` admin default. Every consumer reads this, not the raw property — only sessions built from a snapshot or a spec `layout` set that, so the admin default is what reaches the arrivals that bypass defaultSession.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [moveViewDown](#action-moveviewdown)                               | Actions    | [MultipleViewsSessionMixin](../multipleviewssessionmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [moveViewUp](#action-moveviewup)                                   | Actions    | [MultipleViewsSessionMixin](../multipleviewssessionmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [moveViewToTop](#action-moveviewtotop)                             | Actions    | [MultipleViewsSessionMixin](../multipleviewssessionmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [moveViewToBottom](#action-moveviewtobottom)                       | Actions    | [MultipleViewsSessionMixin](../multipleviewssessionmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [addView](#action-addview)                                         | Actions    | [MultipleViewsSessionMixin](../multipleviewssessionmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [removeView](#action-removeview)                                   | Actions    | [MultipleViewsSessionMixin](../multipleviewssessionmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setStickyViewHeaders](#action-setstickyviewheaders)               | Actions    | [MultipleViewsSessionMixin](../multipleviewssessionmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setUseWorkspaces](#action-setuseworkspaces)                       | Actions    | [MultipleViewsSessionMixin](../multipleviewssessionmixin)               | set the workspaces layout for this session only, leaving the user's personal default untouched. For session-scoped intent — a spec carrying a `layout`, or an ad-hoc "move view to a tab/split" — where rewriting the visitor's global preference would be a surprise. The user-facing default toggle is `setUseWorkspacesPreference`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [setUseWorkspacesPreference](#action-setuseworkspacespreference)   | Actions    | [MultipleViewsSessionMixin](../multipleviewssessionmixin)               | the user-facing workspaces toggle: applies to this session and becomes their default for sessions that don't specify one. Persisted only here, on an explicit toggle — an autorun mirroring the resolved value would bake the admin default into every visitor's localStorage on first load, so a later admin change could never reach them.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [resetUseWorkspaces](#action-resetuseworkspaces)                   | Actions    | [MultipleViewsSessionMixin](../multipleviewssessionmixin)               | drop both this session's explicit value and the user's override so workspaces falls back to the admin default                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [id](#property-id)                                                 | Properties | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [name](#property-name)                                             | Properties | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [margin](#property-margin)                                         | Properties | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [focusedViewId](#property-focusedviewid)                           | Properties | [BaseSessionModel](../basesessionmodel)                                 | used to keep track of which view is in focus                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [highlightsVisible](#property-highlightsvisible)                   | Properties | [BaseSessionModel](../basesessionmodel)                                 | one session-wide toggle for all region highlight bands (URL/view highlights and bookmark overlays)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [selection](#volatile-selection)                                   | Volatiles  | [BaseSessionModel](../basesessionmodel)                                 | this is the globally "selected" object. can be anything. code that wants to deal with this should examine it to see what kind of thing it is.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [hovered](#volatile-hovered)                                       | Volatiles  | [BaseSessionModel](../basesessionmodel)                                 | this is the globally "hovered" object. can be anything. code that wants to deal with this should examine it to see what kind of thing it is.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [queueOfDialogs](#volatile-queueofdialogs)                         | Volatiles  | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [preferencesOverrides](#volatile-preferencesoverrides)             | Volatiles  | [BaseSessionModel](../basesessionmodel)                                 | runtime user-preference overrides keyed by preference id, resolved by `getPreference` against the `configuration.preferences` admin defaults. Empty here (config-only); products that let users edit preferences load and persist these via localStorage. A runtime override map layered over config defaults, kept off the snapshot since prefs are local UI. An `observable.map` (not a plain object reassigned wholesale) so each preference is its own tracked key: writing one (`setScrollZoom`) can't invalidate a reader of another (`getDisplayTypeDefault` in a track's `rpcProps`). A single spread-replaced object made every setter wake every reader, so toggling scroll-to-zoom re-fetched every track. For the same reason each promoted per-display-type default is a flat composite key (see `displayTypeDefaultKey`), not a single nested `displayTypeDefaults` object — promoting one default can't wake readers of a different one. |
| [jbrowse](#getter-jbrowse)                                         | Getters    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [rpcManager](#getter-rpcmanager)                                   | Getters    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [configuration](#getter-configuration)                             | Getters    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [adminMode](#getter-adminmode)                                     | Getters    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [assemblies](#getter-assemblies)                                   | Getters    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [DialogComponent](#getter-dialogcomponent)                         | Getters    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [DialogProps](#getter-dialogprops)                                 | Getters    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [animationMode](#getter-animationmode)                             | Getters    | [BaseSessionModel](../basesessionmodel)                                 | resolved feature-layout animation mode (never undefined)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [scrollZoom](#getter-scrollzoom)                                   | Getters    | [BaseSessionModel](../basesessionmodel)                                 | resolved scroll-to-zoom preference. Global and personal (never shared in a session snapshot); every wheel-zoom view reads this single value.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [getPreference](#method-getpreference)                             | Methods    | [BaseSessionModel](../basesessionmodel)                                 | resolved value of a user preference: a runtime override if the user set one, otherwise the admin/embedder `configuration.preferences` default. The override map is empty unless the product loads it (web/desktop).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [getDisplayTypeDefault](#method-getdisplaytypedefault)             | Methods    | [BaseSessionModel](../basesessionmodel)                                 | resolved value of a per-display-type slot default the user promoted (see `setDisplayTypeDefault`); undefined when nothing was promoted.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [getPreferenceChanges](#method-getpreferencechanges)               | Methods    | [BaseSessionModel](../basesessionmodel)                                 | every runtime preference-override that currently differs from its config/admin default, as `{ path, from, to }` rows — the exact set `clearPreferenceOverrides` reverts. Backs the confirmation diff shown before "Reset to defaults" (mirrors the per-track changes dialog). A scalar pref (animationMode, scrollZoom) whose override equals the default is omitted (reverting it is a no-op); each promoted per-display-type default is always a difference from the un-promoted state, so `from` reads "(default)".                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [setSelection](#action-setselection)                               | Actions    | [BaseSessionModel](../basesessionmodel)                                 | set the global selection, i.e. the globally-selected object. can be a feature, a view, just about anything                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [clearSelection](#action-clearselection)                           | Actions    | [BaseSessionModel](../basesessionmodel)                                 | clears the global selection                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [setHovered](#action-sethovered)                                   | Actions    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setHighlightsVisible](#action-sethighlightsvisible)               | Actions    | [BaseSessionModel](../basesessionmodel)                                 | toggle all region highlight bands across every view                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [revealHighlights](#action-revealhighlights)                       | Actions    | [BaseSessionModel](../basesessionmodel)                                 | turn highlight bands back on, so a newly made highlight or bookmark is never silently swallowed by an earlier "highlights off"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setPreferenceOverride](#action-setpreferenceoverride)             | Actions    | [BaseSessionModel](../basesessionmodel)                                 | set a runtime user-preference override (see `getPreference`). Mutates volatile state; products persist these to localStorage. An `undefined` value deletes the key (rather than leaving a phantom entry that `getPreference` reads as absent) so the store never holds dead keys.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [clearPreferenceOverrides](#action-clearpreferenceoverrides)       | Actions    | [BaseSessionModel](../basesessionmodel)                                 | clear every runtime preference override at once — scrollZoom, animationMode, and every promoted per-display-type default (see `setDisplayTypeDefault`) — so each falls back to its config/admin default. Backs the Preferences dialog "Reset to defaults" button.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [clearPreferenceOverride](#action-clearpreferenceoverride)         | Actions    | [BaseSessionModel](../basesessionmodel)                                 | clear a single runtime preference override (see `getPreference`) so it falls back to its config/admin default. Backs the per-entry reset in the Preferences dialog "Reset to defaults" confirmation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [setScrollZoom](#action-setscrollzoom)                             | Actions    | [BaseSessionModel](../basesessionmodel)                                 | set the global scroll-to-zoom preference (see the `scrollZoom` getter)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [setDisplayTypeDefault](#action-setdisplaytypedefault)             | Actions    | [BaseSessionModel](../basesessionmodel)                                 | promote (or, with `value` undefined, clear) a per-display-type slot default. Just a preference override under one flat composite key (see `displayTypeDefaultKey`), so it persists and independently tracks like any other pref, and clearing deletes only that key.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [setName](#action-setname)                                         | Actions    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setFocusedViewId](#action-setfocusedviewid)                       | Actions    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [removeActiveDialog](#action-removeactivedialog)                   | Actions    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [queueDialog](#action-queuedialog)                                 | Actions    | [BaseSessionModel](../basesessionmodel)                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [snackbarMessages](#volatile-snackbarmessages)                     | Volatiles  | [SnackbarModel](../snackbarmodel)                                       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [errorDialog](#volatile-errordialog)                               | Volatiles  | [SnackbarModel](../snackbarmodel)                                       | the error currently shown in the stack-trace dialog. Kept off the dialog queue so it can stack on top of an already-open dialog (e.g. the one whose action raised the error) instead of waiting behind it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [snackbarMessageSet](#getter-snackbarmessageset)                   | Getters    | [SnackbarModel](../snackbarmodel)                                       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [notify](#action-notify)                                           | Actions    | [SnackbarModel](../snackbarmodel)                                       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [notifyError](#action-notifyerror)                                 | Actions    | [SnackbarModel](../snackbarmodel)                                       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setErrorDialog](#action-seterrordialog)                           | Actions    | [SnackbarModel](../snackbarmodel)                                       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [pushSnackbarMessage](#action-pushsnackbarmessage)                 | Actions    | [SnackbarModel](../snackbarmodel)                                       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [popSnackbarMessage](#action-popsnackbarmessage)                   | Actions    | [SnackbarModel](../snackbarmodel)                                       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [removeSnackbarMessage](#action-removesnackbarmessage)             | Actions    | [SnackbarModel](../snackbarmodel)                                       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [drawerPosition](#property-drawerposition)                         | Properties | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [drawerWidth](#property-drawerwidth)                               | Properties | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [widgets](#property-widgets)                                       | Properties | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [activeWidgets](#property-activewidgets)                           | Properties | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [minimized](#property-minimized)                                   | Properties | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [poppedOut](#volatile-poppedout)                                   | Volatiles  | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 | true while the visible widget is shown in a modal dialog instead of the drawer. Volatile because a restored session that opened straight into a modal, with no drawer behind it, is disorienting                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [visibleWidget](#getter-visiblewidget)                             | Getters    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setDrawerPosition](#action-setdrawerposition)                     | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [updateDrawerWidth](#action-updatedrawerwidth)                     | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [resizeDrawer](#action-resizedrawer)                               | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [addWidget](#action-addwidget)                                     | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [showWidget](#action-showwidget)                                   | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [hideWidget](#action-hidewidget)                                   | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [minimizeWidgetDrawer](#action-minimizewidgetdrawer)               | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [showWidgetDrawer](#action-showwidgetdrawer)                       | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [popoutWidget](#action-popoutwidget)                               | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 | show the visible widget in a modal dialog, freeing the drawer column                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [returnWidgetToDrawer](#action-returnwidgettodrawer)               | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [hideAllWidgets](#action-hideallwidgets)                           | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [editConfiguration](#action-editconfiguration)                     | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)                 | opens a configuration editor to configure the given thing, and sets the current task to be configuring it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [sessionTracks](#property-sessiontracks)                           | Properties | [SessionTracksManagerSessionMixin](../sessiontracksmanagersessionmixin) | User-added session tracks (no matching admin config track). A non-admin's _edits_ to an existing config track are stored as deltas (trackConfigDeltas), not here.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [trackConfigDeltas](#property-trackconfigdeltas)                   | Properties | [SessionTracksManagerSessionMixin](../sessiontracksmanagersessionmixin) | Per-track config overrides for a non-admin, keyed by trackId, stored as a _delta_ against the admin-owned base config (jbrowse.tracks entry) rather than a full copy — so a later admin change to an untouched field still flows through (see trackConfigDelta.ts). Frozen (not a typed track array) on purpose: a typed create() would fill defaults, erasing the "unset vs default" distinction the delta merge relies on.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [editableTrackConfigs](#volatile-editabletrackconfigs)             | Volatiles  | [SessionTracksManagerSessionMixin](../sessiontracksmanagersessionmixin) | Per-track private working copies (non-admin), keyed by trackId. A plain Map — not observable, not persisted — mirroring the pluginManager hydration cache: it holds the live MST config node a shown track's in-place quick-edits mutate, so the shared frozen base is never touched. See agent-docs/ADR-032. Not evicted: it's a pure memoization cache, bounded by the count of distinct tracks shown this session (each entry a lazily-hydrated config node), holding no authoritative state — the persisted delta is the source of truth, and reset/programmatic edits keep a retained copy in sync. Retention is volatile RAM only (never serialized), so it's not worth a reference-counted prune at every track-removal path.                                                                                                                                                                                                                    |
| [tracks](#getter-tracks)                                           | Getters    | [SessionTracksManagerSessionMixin](../sessiontracksmanagersessionmixin) | User-added session tracks first, then each admin config track with its delta (trackConfigDeltas) merged over it. A base track without a delta is returned unchanged by identity to keep the hydration cache warm.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [getTrackConfigChanges](#method-gettrackconfigchanges)             | Methods    | [SessionTracksManagerSessionMixin](../sessiontracksmanagersessionmixin) | The overridden slots for `trackId` (empty when it has no delta): each changed setting's path, its base/default value and the edited value. Drives the "view changes" dialog opened from the edited badge.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [getEditableTrackConfig](#method-geteditabletrackconfig)           | Methods    | [SessionTracksManagerSessionMixin](../sessiontracksmanagersessionmixin) | A non-admin's private working copy of a track config, created on first access from the current frozen (base+delta) value and cached by trackId, so a shown track's in-place quick-edits (setSlot) mutate this copy and never the shared frozen base node (see ADR-032). Undefined in admin mode — there the base jbrowse.tracks entry is edited in place. Called by TrackConfigurationReference during lazy hydration.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [addTrackConf](#action-addtrackconf)                               | Actions    | [SessionTracksManagerSessionMixin](../sessiontracksmanagersessionmixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [updateTrackConfiguration](#action-updatetrackconfiguration)       | Actions    | [SessionTracksManagerSessionMixin](../sessiontracksmanagersessionmixin) | Persist a non-admin's edited track config as a delta (trackConfigDeltas) against the admin-owned base — only the changed slots — so the edits persist and are shared while admin changes to untouched fields still flow through. A user-added session track (no base) is edited in place. Everything else (admin edits, opened connection tracks) defers to the base mixin, which routes connection tracks to connectionTrackConfigs and the rest to the jbrowse config.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [resetTrackConfiguration](#action-resettrackconfiguration)         | Actions    | [SessionTracksManagerSessionMixin](../sessiontracksmanagersessionmixin) | Drop a non-admin's delta (trackConfigDeltas) so the track reverts to its admin config (jbrowse.tracks) default. Unlike deleteTrackConf this does not dereference the track from open views — the base config re-resolves in place, so an open track stays open and simply reverts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [deleteTrackConf](#action-deletetrackconf)                         | Actions    | [SessionTracksManagerSessionMixin](../sessiontracksmanagersessionmixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [getTrackById](#method-gettrackbyid)                               | Methods    | [TracksManagerSessionMixin](../tracksmanagersessionmixin)               | Config for one trackId — a track, assembly sequence, or connection track — or undefined. Per-id reactive: every display resolves its config through this (via TrackConfigurationReference) and subscribes only to its own id, so one track's settings edit doesn't re-render the others.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [getTracksById](#method-gettracksbyid)                             | Methods    | [TracksManagerSessionMixin](../tracksmanagersessionmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [sessionAssemblies](#property-sessionassemblies)                   | Properties | [AssembliesMixin](../assembliesmixin)                                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [temporaryAssemblies](#property-temporaryassemblies)               | Properties | [AssembliesMixin](../assembliesmixin)                                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [assemblyNames](#getter-assemblynames)                             | Getters    | [AssembliesMixin](../assembliesmixin)                                   | names of the assemblies returned by the `assemblies` getter                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [addSessionAssembly](#action-addsessionassembly)                   | Actions    | [AssembliesMixin](../assembliesmixin)                                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [addAssembly](#action-addassembly)                                 | Actions    | [AssembliesMixin](../assembliesmixin)                                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [removeAssembly](#action-removeassembly)                           | Actions    | [AssembliesMixin](../assembliesmixin)                                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [removeSessionAssembly](#action-removesessionassembly)             | Actions    | [AssembliesMixin](../assembliesmixin)                                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [addTemporaryAssembly](#action-addtemporaryassembly)               | Actions    | [AssembliesMixin](../assembliesmixin)                                   | used for read vs ref type assemblies.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [removeTemporaryAssembly](#action-removetemporaryassembly)         | Actions    | [AssembliesMixin](../assembliesmixin)                                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [version](#getter-version)                                         | Getters    | [AppSessionMixin](../appsessionmixin)                                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [gitCommit](#getter-gitcommit)                                     | Getters    | [AppSessionMixin](../appsessionmixin)                                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [history](#getter-history)                                         | Getters    | [AppSessionMixin](../appsessionmixin)                                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [assemblyManager](#getter-assemblymanager)                         | Getters    | [AppSessionMixin](../appsessionmixin)                                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [menus](#method-menus)                                             | Methods    | [AppSessionMixin](../appsessionmixin)                                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [renameCurrentSession](#action-renamecurrentsession)               | Actions    | [AppSessionMixin](../appsessionmixin)                                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [sessionConnections](#property-sessionconnections)                 | Properties | [WebSessionConnectionsMixin](../websessionconnectionsmixin)             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [addConnectionConf](#action-addconnectionconf)                     | Actions    | [WebSessionConnectionsMixin](../websessionconnectionsmixin)             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [deleteConnection](#action-deleteconnection)                       | Actions    | [WebSessionConnectionsMixin](../websessionconnectionsmixin)             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [connectionInstances](#property-connectioninstances)               | Properties | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [connectionTrackConfigs](#property-connectiontrackconfigs)         | Properties | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Persisted configs of connection tracks the user has opened, keyed by trackId. Unlike `connectionInstances` (stripped from snapshots, holds the whole fetched hub), this holds only the tracks in use, so an open connection track resolves synchronously on session load without re-establishing the connection.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [makeConnection](#action-makeconnection)                           | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [breakConnection](#action-breakconnection)                         | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Remove a live connection instance. Tolerant of an already-dormant connection (its instance is stripped from the session on reload). Leaves persisted open-track configs alone — the connect() error path calls this and the user's already-open tracks must survive a transient failure. Full removal goes through `deleteConnection`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [teardownConnection](#action-teardownconnection)                   | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Close every track a connection contributed — the live instance's tracks plus any persisted open-track configs (a dormant connection, never expanded this session, still renders its opened tracks from `connectionTrackConfigs`) — from all views/widgets, drop the live instance, and drop the persisted configs. The session is left as if the connection had never loaded.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [clearConnections](#action-clearconnections)                       | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [captureConnectionTrack](#action-captureconnectiontrack)           | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Snapshot a just-opened connection track's config into `connectionTrackConfigs` so it survives session reload. No-op if the track isn't connection-provided or is already captured (edits go through `updateConnectionTrackConfig`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [updateConnectionTrackConfig](#action-updateconnectiontrackconfig) | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Persist an edit to an opened connection track. The full config is stored (not a delta): the connection's fetched "base" isn't present at load, so only a complete config resolves synchronously.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [setConnectionTrackConfig](#action-setconnectiontrackconfig)       | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Upsert one opened connection track's persisted config.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [pruneConnectionTrackConfig](#action-pruneconnectiontrackconfig)   | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Drop a connection track's persisted config once no open view still references it, so the session doesn't accumulate closed tracks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [hydrateConnection](#action-hydrateconnection)                     | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Lazily establish a single connection by id if it isn't already live — used when its category is expanded in the track selector. Fetches silently (no view launch / success snackbar); already-open tracks keep rendering from `connectionTrackConfigs` meanwhile. Idempotent.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [dockviewLayout](#property-dockviewlayout)                         | Properties | [DockviewLayoutMixin](../dockviewlayoutmixin)                           | Serialized dockview layout state                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [panelViewAssignments](#property-panelviewassignments)             | Properties | [DockviewLayoutMixin](../dockviewlayoutmixin)                           | Maps panel IDs to arrays of view IDs (for stacking views within a panel)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [activePanelId](#property-activepanelid)                           | Properties | [DockviewLayoutMixin](../dockviewlayoutmixin)                           | The currently active panel ID in dockview                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [init](#property-init)                                             | Properties | [DockviewLayoutMixin](../dockviewlayoutmixin)                           | The initial nested layout to build dockview from (simple viewIds/ direction/size form, vs. the verbose `dockviewLayout` dockview emits). Set from URL params (spec layout) OR carried in a loaded session snapshot (e.g. the `encoded-` session param), then consumed once when the dockview container mounts — `createInitialPanels` reads it, `applyInitLayout` builds the panels, and it is cleared to undefined (stripped from snapshots) so it never re-applies on a later remount.                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [pendingMove](#volatile-pendingmove)                               | Volatiles  | [DockviewLayoutMixin](../dockviewlayoutmixin)                           |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [getViewIdsForPanel](#getter-getviewidsforpanel)                   | Getters    | [DockviewLayoutMixin](../dockviewlayoutmixin)                           | Get view IDs for a specific panel, as a plain snapshot array. Never the live MST node: callers iterate this while removing views (which splices the underlying array via the reconcile autorun), so leaking the live array would skip elements mid-iteration. Mutators go through getPanelContainingView instead.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [getPanelContainingView](#getter-getpanelcontainingview)           | Getters    | [DockviewLayoutMixin](../dockviewlayoutmixin)                           | Find the panel containing a view, returning the panel ID, that panel's view-ID list, and the view's index within it (or undefined if unassigned)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [setDockviewLayout](#action-setdockviewlayout)                     | Actions    | [DockviewLayoutMixin](../dockviewlayoutmixin)                           | Save the current dockview layout                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [setActivePanelId](#action-setactivepanelid)                       | Actions    | [DockviewLayoutMixin](../dockviewlayoutmixin)                           | Set the active panel ID                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setInit](#action-setinit)                                         | Actions    | [DockviewLayoutMixin](../dockviewlayoutmixin)                           | Set the initial layout configuration (from URL params)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [setPendingMove](#action-setpendingmove)                           | Actions    | [DockviewLayoutMixin](../dockviewlayoutmixin)                           | Queue a view move to be applied when the dockview container mounts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [assignViewToPanel](#action-assignviewtopanel)                     | Actions    | [DockviewLayoutMixin](../dockviewlayoutmixin)                           | Assign a view to a panel (adds to the panel's view stack)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [removeViewFromPanel](#action-removeviewfrompanel)                 | Actions    | [DockviewLayoutMixin](../dockviewlayoutmixin)                           | Remove a view from its panel                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [removePanel](#action-removepanel)                                 | Actions    | [DockviewLayoutMixin](../dockviewlayoutmixin)                           | Remove a panel and all its view assignments                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [moveViewUpInPanel](#action-moveviewupinpanel)                     | Actions    | [DockviewLayoutMixin](../dockviewlayoutmixin)                           | Move a view up within its panel's view stack                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [moveViewDownInPanel](#action-moveviewdowninpanel)                 | Actions    | [DockviewLayoutMixin](../dockviewlayoutmixin)                           | Move a view down within its panel's view stack                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [moveViewToTopInPanel](#action-moveviewtotopinpanel)               | Actions    | [DockviewLayoutMixin](../dockviewlayoutmixin)                           | Move a view to the top of its panel's view stack                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [moveViewToBottomInPanel](#action-moveviewtobottominpanel)         | Actions    | [DockviewLayoutMixin](../dockviewlayoutmixin)                           | Move a view to the bottom of its panel's view stack                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [getTrackListMenuItems](#method-gettracklistmenuitems)             | Methods    | [TrackMenuItemsSessionMixin](../trackmenuitemssessionmixin)             | flattened menu items for use in hierarchical track selector                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [getTrackActionMenuItems](#method-gettrackactionmenuitems)         | Methods    | [TrackMenuItemsSessionMixin](../trackmenuitemssessionmixin)             | track menu with About + "Track actions" submenu for the in-view label                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

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

opens the config editor for a track. Available for any track: a non-admin's
edits to an admin-owned track persist as a delta (trackConfigDeltas) that rides
along in the shared/saved session, rather than mutating the admin-owned config
itself.

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

#### getter: themeName

```ts
type themeName = string
```

#### getter: themeOptions

```ts
type themeOptions = SerializableThemeArgs
```

#### getter: theme

```ts
type theme = Theme
```

**Methods**

#### method: allThemes

```ts
type allThemes = () => ThemeMap
```

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

**Actions**

#### action: setThemeName

```ts
type setThemeName = (name: string) => void
```

</details>

<details>
<summary>Derived from MultipleViewsSessionMixin</summary>

[MultipleViewsSessionMixin →](../multipleviewssessionmixin)

**Properties**

#### property: views

```ts
// type signature
type views = IArrayType<IAnyType>
// code
views: types.array(pluginManager.pluggableMstType('view', 'stateModel'))
```

#### property: stickyViewHeaders

```ts
// type signature
type stickyViewHeaders = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
stickyViewHeaders: types.optional(types.boolean, () =>
  localStorageGetBoolean('stickyViewHeaders', true),
)
```

#### property: useWorkspaces

enables the dockview-based tabbed/tiled workspace layout for this session.
Undefined means unspecified — read `effectiveUseWorkspaces`.

```ts
// type signature
type useWorkspaces = IOptionalIType<IMaybe<ISimpleType<boolean>>, [undefined]>
// code
useWorkspaces: types.stripDefault(types.maybe(types.boolean), undefined)
```

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

#### action: moveViewDown

```ts
type moveViewDown = (id: string) => void
```

#### action: moveViewUp

```ts
type moveViewUp = (id: string) => void
```

#### action: moveViewToTop

```ts
type moveViewToTop = (id: string) => void
```

#### action: moveViewToBottom

```ts
type moveViewToBottom = (id: string) => void
```

#### action: addView

```ts
type addView = (typeName: string, initialState?: any) => any
```

#### action: removeView

```ts
type removeView = (view: IBaseViewModel) => void
```

#### action: setStickyViewHeaders

```ts
type setStickyViewHeaders = (sticky: boolean) => void
```

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

</details>

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

**Getters**

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

#### action: popoutWidget

show the visible widget in a modal dialog, freeing the drawer column

```ts
type popoutWidget = () => void
```

#### action: returnWidgetToDrawer

```ts
type returnWidgetToDrawer = () => void
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
type tracks = (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]
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

#### action: addTrackConf

```ts
type addTrackConf = (trackConf: AnyConfiguration) => any
```

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

#### action: deleteTrackConf

```ts
type deleteTrackConf = (trackConf: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => any[] | undefined
```

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
type getTrackById = (id: string) => (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) | undefined
```

#### method: getTracksById

```ts
type getTracksById = () => Record<string, ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>>
```

</details>

<details>
<summary>Derived from AssembliesMixin</summary>

[AssembliesMixin →](../assembliesmixin)

**Properties**

#### property: sessionAssemblies

```ts
// type signature
type sessionAssemblies = IOptionalIType<IArrayType<ConfigurationSchemaType<{ readonly aliases: { readonly type: "stringArray"; readonly defaultValue: readonly []; readonly description: "Other possible names for the assembly"; }; readonly sequence: AnyConfigurationSchemaType; ... 5 more ...; readonly displayName: { ...; }; }, ConfigurationSc...
// code
sessionAssemblies: types.stripDefault(
        types.array(assemblyConfigSchemasType),
        [],
      )
```

#### property: temporaryAssemblies

```ts
// type signature
type temporaryAssemblies = IOptionalIType<IArrayType<ConfigurationSchemaType<{ readonly aliases: { readonly type: "stringArray"; readonly defaultValue: readonly []; readonly description: "Other possible names for the assembly"; }; readonly sequence: AnyConfigurationSchemaType; ... 5 more ...; readonly displayName: { ...; }; }, ConfigurationSc...
// code
temporaryAssemblies: types.stripDefault(
        types.array(assemblyConfigSchemasType),
        [],
      )
```

**Getters**

#### getter: assemblyNames

names of the assemblies returned by the `assemblies` getter

```ts
type assemblyNames = string[]
```

**Actions**

#### action: addSessionAssembly

```ts
type addSessionAssembly = (conf: AnyConfiguration) => ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>
```

#### action: addAssembly

```ts
type addAssembly = (conf: AnyConfiguration) => void
```

#### action: removeAssembly

```ts
type removeAssembly = (name: string) => void
```

#### action: removeSessionAssembly

```ts
type removeSessionAssembly = (assemblyName: string) => void
```

#### action: addTemporaryAssembly

used for read vs ref type assemblies.

```ts
type addTemporaryAssembly = (conf: AnyConfiguration) => ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>
```

#### action: removeTemporaryAssembly

```ts
type removeTemporaryAssembly = (name: string) => void
```

</details>

<details>
<summary>Derived from AppSessionMixin</summary>

[AppSessionMixin →](../appsessionmixin)

**Getters**

#### getter: version

```ts
type version = string
```

#### getter: gitCommit

```ts
type gitCommit = string | undefined
```

#### getter: history

```ts
type history =
  { canUndo: boolean; canRedo: boolean; undo(): void; redo(): void } | undefined
```

#### getter: assemblyManager

```ts
type assemblyManager = ModelInstanceTypeProps<{ assemblies: IArrayType<IModelType<{ configuration: IMaybe<IReferenceType<IAnyType>>; }, { error: unknown; loadingP: Promise<void> | undefined; adapterLoads: QuickLRU<...>; ... 5 more ...; lowerCaseRefNameAliases: RefNameAliases | undefined; } & ... 11 more ... & { ...; }, _NotCustomized, _No...
```

**Methods**

#### method: menus

```ts
type menus = () => Menu[]
```

**Actions**

#### action: renameCurrentSession

```ts
type renameCurrentSession = (sessionName: string) => void
```

</details>

<details>
<summary>Derived from WebSessionConnectionsMixin</summary>

[WebSessionConnectionsMixin →](../websessionconnectionsmixin)

**Properties**

#### property: sessionConnections

```ts
// type signature
type sessionConnections = IOptionalIType<IArrayType<IAnyModelType>, [undefined]>
// code
sessionConnections: types.stripDefault(
  types.array(pluginManager.pluggableConfigSchemaType('connection')),
  [],
)
```

**Actions**

#### action: addConnectionConf

```ts
type addConnectionConf = (connectionConf: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => any
```

#### action: deleteConnection

```ts
type deleteConnection = (configuration: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => any
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

#### volatile: pendingMove

```ts
// type signature
type pendingMove = undefined
// code
pendingMove: undefined
```

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
type getTrackListMenuItems = (config: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>, view?: TrackActionView | undefined) => MenuItem[]
```

#### method: getTrackActionMenuItems

track menu with About + "Track actions" submenu for the in-view label

```ts
type getTrackActionMenuItems = ({ config, view, }: { config: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>; view?: TrackActionView | undefined; }) => MenuItem[]
```

</details>
