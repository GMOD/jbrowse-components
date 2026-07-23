---
id: multipleviewssessionmixin
title: MultipleViewsSessionMixin
sidebar_label: Mixin -> MultipleViewsSessionMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/MultipleViews.ts).

## Overview

## Members

| Member                                                           | Kind       | Defined by                                              | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------- | ---------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [views](#property-views)                                         | Properties | MultipleViewsSessionMixin                               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [stickyViewHeaders](#property-stickyviewheaders)                 | Properties | MultipleViewsSessionMixin                               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [useWorkspaces](#property-useworkspaces)                         | Properties | MultipleViewsSessionMixin                               | enables the dockview-based tabbed/tiled workspace layout for this session specifically. Undefined means "unspecified": read `effectiveUseWorkspaces`, which falls back to the user's preference and then the `configuration.preferences.useWorkspaces` admin default.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [effectiveUseWorkspaces](#getter-effectiveuseworkspaces)         | Getters    | MultipleViewsSessionMixin                               | resolved workspaces layout flag (never undefined): this session's explicit value if it has one, else the user preference resolved against the admin default. Every consumer reads this, not the raw property — only the four session-creation paths that carry a snapshot set that.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [moveViewDown](#action-moveviewdown)                             | Actions    | MultipleViewsSessionMixin                               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [moveViewUp](#action-moveviewup)                                 | Actions    | MultipleViewsSessionMixin                               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [moveViewToTop](#action-moveviewtotop)                           | Actions    | MultipleViewsSessionMixin                               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [moveViewToBottom](#action-moveviewtobottom)                     | Actions    | MultipleViewsSessionMixin                               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [addView](#action-addview)                                       | Actions    | MultipleViewsSessionMixin                               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [removeView](#action-removeview)                                 | Actions    | MultipleViewsSessionMixin                               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setStickyViewHeaders](#action-setstickyviewheaders)             | Actions    | MultipleViewsSessionMixin                               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setUseWorkspaces](#action-setuseworkspaces)                     | Actions    | MultipleViewsSessionMixin                               | set the workspaces layout for this session only, leaving the user's personal default untouched. For session-scoped intent (a spec carrying a `layout`); the user-facing toggle is `setUseWorkspacesPreference`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setUseWorkspacesPreference](#action-setuseworkspacespreference) | Actions    | MultipleViewsSessionMixin                               | the user-facing workspaces toggle: applies to this session and becomes their default for sessions that don't specify one. Persisted only here, on an explicit toggle — an autorun mirroring the resolved value would bake the admin default into every visitor's localStorage on first load, so a later admin change could never reach them.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [resetUseWorkspaces](#action-resetuseworkspaces)                 | Actions    | MultipleViewsSessionMixin                               | drop both this session's explicit value and the user's override so workspaces falls back to the admin default                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [id](#property-id)                                               | Properties | [BaseSessionModel](../basesessionmodel)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [name](#property-name)                                           | Properties | [BaseSessionModel](../basesessionmodel)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [margin](#property-margin)                                       | Properties | [BaseSessionModel](../basesessionmodel)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [focusedViewId](#property-focusedviewid)                         | Properties | [BaseSessionModel](../basesessionmodel)                 | used to keep track of which view is in focus                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [highlightsVisible](#property-highlightsvisible)                 | Properties | [BaseSessionModel](../basesessionmodel)                 | one session-wide toggle for all region highlight bands (URL/view highlights and bookmark overlays)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [selection](#volatile-selection)                                 | Volatiles  | [BaseSessionModel](../basesessionmodel)                 | this is the globally "selected" object. can be anything. code that wants to deal with this should examine it to see what kind of thing it is.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [hovered](#volatile-hovered)                                     | Volatiles  | [BaseSessionModel](../basesessionmodel)                 | this is the globally "hovered" object. can be anything. code that wants to deal with this should examine it to see what kind of thing it is.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [queueOfDialogs](#volatile-queueofdialogs)                       | Volatiles  | [BaseSessionModel](../basesessionmodel)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [preferencesOverrides](#volatile-preferencesoverrides)           | Volatiles  | [BaseSessionModel](../basesessionmodel)                 | runtime user-preference overrides keyed by preference id, resolved by `getPreference` against the `configuration.preferences` admin defaults. Empty here (config-only); products that let users edit preferences load and persist these via localStorage. A runtime override map layered over config defaults, kept off the snapshot since prefs are local UI. An `observable.map` (not a plain object reassigned wholesale) so each preference is its own tracked key: writing one (`setScrollZoom`) can't invalidate a reader of another (`getDisplayTypeDefault` in a track's `rpcProps`). A single spread-replaced object made every setter wake every reader, so toggling scroll-to-zoom re-fetched every track. For the same reason each promoted per-display-type default is a flat composite key (see `displayTypeDefaultKey`), not a single nested `displayTypeDefaults` object — promoting one default can't wake readers of a different one. |
| [root](#getter-root)                                             | Getters    | [BaseSessionModel](../basesessionmodel)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [jbrowse](#getter-jbrowse)                                       | Getters    | [BaseSessionModel](../basesessionmodel)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [rpcManager](#getter-rpcmanager)                                 | Getters    | [BaseSessionModel](../basesessionmodel)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [configuration](#getter-configuration)                           | Getters    | [BaseSessionModel](../basesessionmodel)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [adminMode](#getter-adminmode)                                   | Getters    | [BaseSessionModel](../basesessionmodel)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [textSearchManager](#getter-textsearchmanager)                   | Getters    | [BaseSessionModel](../basesessionmodel)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [assemblies](#getter-assemblies)                                 | Getters    | [BaseSessionModel](../basesessionmodel)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [DialogComponent](#getter-dialogcomponent)                       | Getters    | [BaseSessionModel](../basesessionmodel)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [DialogProps](#getter-dialogprops)                               | Getters    | [BaseSessionModel](../basesessionmodel)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [animationMode](#getter-animationmode)                           | Getters    | [BaseSessionModel](../basesessionmodel)                 | resolved feature-layout animation mode (never undefined)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [scrollZoom](#getter-scrollzoom)                                 | Getters    | [BaseSessionModel](../basesessionmodel)                 | resolved scroll-to-zoom preference. Global and personal (never shared in a session snapshot); every wheel-zoom view reads this single value.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [getPreference](#method-getpreference)                           | Methods    | [BaseSessionModel](../basesessionmodel)                 | resolved value of a user preference: a runtime override if the user set one, otherwise the admin/embedder `configuration.preferences` default. The override map is empty unless the product loads it (web/desktop).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [getDisplayTypeDefault](#method-getdisplaytypedefault)           | Methods    | [BaseSessionModel](../basesessionmodel)                 | resolved value of a per-display-type slot default the user promoted (see `setDisplayTypeDefault`); undefined when nothing was promoted.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [getPreferenceChanges](#method-getpreferencechanges)             | Methods    | [BaseSessionModel](../basesessionmodel)                 | every runtime preference-override that currently differs from its config/admin default, as `{ path, from, to }` rows — the exact set `clearPreferenceOverrides` reverts. Backs the confirmation diff shown before "Reset to defaults" (mirrors the per-track changes dialog). A scalar pref (animationMode, scrollZoom) whose override equals the default is omitted (reverting it is a no-op); each promoted per-display-type default is always a difference from the un-promoted state, so `from` reads "(default)".                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [setSelection](#action-setselection)                             | Actions    | [BaseSessionModel](../basesessionmodel)                 | set the global selection, i.e. the globally-selected object. can be a feature, a view, just about anything                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [clearSelection](#action-clearselection)                         | Actions    | [BaseSessionModel](../basesessionmodel)                 | clears the global selection                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [setHovered](#action-sethovered)                                 | Actions    | [BaseSessionModel](../basesessionmodel)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setHighlightsVisible](#action-sethighlightsvisible)             | Actions    | [BaseSessionModel](../basesessionmodel)                 | toggle all region highlight bands across every view                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [revealHighlights](#action-revealhighlights)                     | Actions    | [BaseSessionModel](../basesessionmodel)                 | turn highlight bands back on, so a newly made highlight or bookmark is never silently swallowed by an earlier "highlights off"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setPreferenceOverride](#action-setpreferenceoverride)           | Actions    | [BaseSessionModel](../basesessionmodel)                 | set a runtime user-preference override (see `getPreference`). Mutates volatile state; products persist these to localStorage. An `undefined` value deletes the key (rather than leaving a phantom entry that `getPreference` reads as absent) so the store never holds dead keys.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [clearPreferenceOverrides](#action-clearpreferenceoverrides)     | Actions    | [BaseSessionModel](../basesessionmodel)                 | clear every runtime preference override at once — scrollZoom, animationMode, and every promoted per-display-type default (see `setDisplayTypeDefault`) — so each falls back to its config/admin default. Backs the Preferences dialog "Reset to defaults" button.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [clearPreferenceOverride](#action-clearpreferenceoverride)       | Actions    | [BaseSessionModel](../basesessionmodel)                 | clear a single runtime preference override (see `getPreference`) so it falls back to its config/admin default. Backs the per-entry reset in the Preferences dialog "Reset to defaults" confirmation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [setScrollZoom](#action-setscrollzoom)                           | Actions    | [BaseSessionModel](../basesessionmodel)                 | set the global scroll-to-zoom preference (see the `scrollZoom` getter)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [setDisplayTypeDefault](#action-setdisplaytypedefault)           | Actions    | [BaseSessionModel](../basesessionmodel)                 | promote (or, with `value` undefined, clear) a per-display-type slot default. Just a preference override under one flat composite key (see `displayTypeDefaultKey`), so it persists and independently tracks like any other pref, and clearing deletes only that key.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [setName](#action-setname)                                       | Actions    | [BaseSessionModel](../basesessionmodel)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setFocusedViewId](#action-setfocusedviewid)                     | Actions    | [BaseSessionModel](../basesessionmodel)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [removeActiveDialog](#action-removeactivedialog)                 | Actions    | [BaseSessionModel](../basesessionmodel)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [queueDialog](#action-queuedialog)                               | Actions    | [BaseSessionModel](../basesessionmodel)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [snackbarMessages](#volatile-snackbarmessages)                   | Volatiles  | [SnackbarModel](../snackbarmodel)                       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [errorDialog](#volatile-errordialog)                             | Volatiles  | [SnackbarModel](../snackbarmodel)                       | the error currently shown in the stack-trace dialog. Kept off the dialog queue so it can stack on top of an already-open dialog (e.g. the one whose action raised the error) instead of waiting behind it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [snackbarMessageSet](#getter-snackbarmessageset)                 | Getters    | [SnackbarModel](../snackbarmodel)                       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [notify](#action-notify)                                         | Actions    | [SnackbarModel](../snackbarmodel)                       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [notifyError](#action-notifyerror)                               | Actions    | [SnackbarModel](../snackbarmodel)                       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setErrorDialog](#action-seterrordialog)                         | Actions    | [SnackbarModel](../snackbarmodel)                       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [pushSnackbarMessage](#action-pushsnackbarmessage)               | Actions    | [SnackbarModel](../snackbarmodel)                       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [popSnackbarMessage](#action-popsnackbarmessage)                 | Actions    | [SnackbarModel](../snackbarmodel)                       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [removeSnackbarMessage](#action-removesnackbarmessage)           | Actions    | [SnackbarModel](../snackbarmodel)                       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [drawerPosition](#property-drawerposition)                       | Properties | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [drawerWidth](#property-drawerwidth)                             | Properties | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [widgets](#property-widgets)                                     | Properties | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [activeWidgets](#property-activewidgets)                         | Properties | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [minimized](#property-minimized)                                 | Properties | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [poppedOut](#volatile-poppedout)                                 | Volatiles  | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin) | true while the visible widget is shown in a modal dialog instead of the drawer. Volatile because a restored session that opened straight into a modal, with no drawer behind it, is disorienting                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [visibleWidget](#getter-visiblewidget)                           | Getters    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setDrawerPosition](#action-setdrawerposition)                   | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [updateDrawerWidth](#action-updatedrawerwidth)                   | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [resizeDrawer](#action-resizedrawer)                             | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [addWidget](#action-addwidget)                                   | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [showWidget](#action-showwidget)                                 | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [hideWidget](#action-hidewidget)                                 | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [minimizeWidgetDrawer](#action-minimizewidgetdrawer)             | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [showWidgetDrawer](#action-showwidgetdrawer)                     | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [popoutWidget](#action-popoutwidget)                             | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin) | show the visible widget in a modal dialog, freeing the drawer column                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [returnWidgetToDrawer](#action-returnwidgettodrawer)             | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [hideAllWidgets](#action-hideallwidgets)                         | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [editConfiguration](#action-editconfiguration)                   | Actions    | [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin) | opens a configuration editor to configure the given thing, and sets the current task to be configuring it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

<details>
<summary>MultipleViewsSessionMixin - Properties</summary>

#### property: useWorkspaces

enables the dockview-based tabbed/tiled workspace layout for this session
specifically. Undefined means "unspecified": read `effectiveUseWorkspaces`,
which falls back to the user's preference and then the
`configuration.preferences.useWorkspaces` admin default.

```ts
// type signature
type useWorkspaces = IOptionalIType<IMaybe<ISimpleType<boolean>>, [undefined]>
// code
useWorkspaces: types.stripDefault(types.maybe(types.boolean), undefined)
```

</details>

<details>
<summary>MultipleViewsSessionMixin - Properties (other undocumented members)</summary>

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

</details>

<details>
<summary>MultipleViewsSessionMixin - Getters</summary>

#### getter: effectiveUseWorkspaces

resolved workspaces layout flag (never undefined): this session's explicit value
if it has one, else the user preference resolved against the admin default.
Every consumer reads this, not the raw property — only the four session-creation
paths that carry a snapshot set that.

```ts
type effectiveUseWorkspaces = boolean
```

</details>

<details>
<summary>MultipleViewsSessionMixin - Actions</summary>

#### action: setUseWorkspaces

set the workspaces layout for this session only, leaving the user's personal
default untouched. For session-scoped intent (a spec carrying a `layout`); the
user-facing toggle is `setUseWorkspacesPreference`.

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
<summary>MultipleViewsSessionMixin - Actions (other undocumented members)</summary>

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
