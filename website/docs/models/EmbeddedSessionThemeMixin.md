---
id: embeddedsessionthememixin
title: EmbeddedSessionThemeMixin
sidebar_label: Mixin -> EmbeddedSessionThemeMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/embedded-core/src/EmbeddedSessionThemeMixin.ts).

## Overview

Theme getters shared by the single-view embedded sessions
(react-linear-genome-view, react-circular-genome-view). Embedded products have
no theme switching, so the active theme is always `default`; the config `theme`
slot still applies via `configTheme`.

## Members

| Member                                                       | Kind       | Defined by                              | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------ | ---------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [themeOptions](#getter-themeoptions)                         | Getters    | EmbeddedSessionThemeMixin               | Serializable theme description (the canonical `themeOptions` contract shared with the app-core/web sessions). This is what crosses the RPC worker boundary — e.g. the canvas display reads `getSession(self).themeOptions` in its rpcProps so worker-baked colors (CDS frames, stroke fallback) honor the config `theme` slot.                                                                                                                                                                                         |
| [theme](#getter-theme)                                       | Getters    | EmbeddedSessionThemeMixin               | Resolved MUI theme, mirroring the product's ThemeProvider. Lets headless/RPC consumers derive theme-dependent state without a mounted component.                                                                                                                                                                                                                                                                                                                                                                       |
| [id](#property-id)                                           | Properties | [BaseSessionModel](../basesessionmodel) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [name](#property-name)                                       | Properties | [BaseSessionModel](../basesessionmodel) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [margin](#property-margin)                                   | Properties | [BaseSessionModel](../basesessionmodel) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [focusedViewId](#property-focusedviewid)                     | Properties | [BaseSessionModel](../basesessionmodel) | used to keep track of which view is in focus                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [highlightsVisible](#property-highlightsvisible)             | Properties | [BaseSessionModel](../basesessionmodel) | one session-wide toggle for all region highlight bands (URL/view highlights and bookmark overlays)                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [selection](#volatile-selection)                             | Volatiles  | [BaseSessionModel](../basesessionmodel) | this is the globally "selected" object. can be anything. code that wants to deal with this should examine it to see what kind of thing it is.                                                                                                                                                                                                                                                                                                                                                                          |
| [hovered](#volatile-hovered)                                 | Volatiles  | [BaseSessionModel](../basesessionmodel) | this is the globally "hovered" object. can be anything. code that wants to deal with this should examine it to see what kind of thing it is.                                                                                                                                                                                                                                                                                                                                                                           |
| [queueOfDialogs](#volatile-queueofdialogs)                   | Volatiles  | [BaseSessionModel](../basesessionmodel) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [preferencesOverrides](#volatile-preferencesoverrides)       | Volatiles  | [BaseSessionModel](../basesessionmodel) | runtime user-preference overrides keyed by preference id, resolved by `getPreference` against the `configuration.preferences` admin defaults. Empty here (config-only); products that let users edit preferences load and persist these via localStorage. A runtime override map layered over config defaults, kept off the snapshot since prefs are local UI.                                                                                                                                                         |
| [root](#getter-root)                                         | Getters    | [BaseSessionModel](../basesessionmodel) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [jbrowse](#getter-jbrowse)                                   | Getters    | [BaseSessionModel](../basesessionmodel) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [rpcManager](#getter-rpcmanager)                             | Getters    | [BaseSessionModel](../basesessionmodel) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [configuration](#getter-configuration)                       | Getters    | [BaseSessionModel](../basesessionmodel) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [adminMode](#getter-adminmode)                               | Getters    | [BaseSessionModel](../basesessionmodel) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [textSearchManager](#getter-textsearchmanager)               | Getters    | [BaseSessionModel](../basesessionmodel) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [assemblies](#getter-assemblies)                             | Getters    | [BaseSessionModel](../basesessionmodel) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [DialogComponent](#getter-dialogcomponent)                   | Getters    | [BaseSessionModel](../basesessionmodel) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [DialogProps](#getter-dialogprops)                           | Getters    | [BaseSessionModel](../basesessionmodel) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [animationMode](#getter-animationmode)                       | Getters    | [BaseSessionModel](../basesessionmodel) | resolved feature-layout animation mode (never undefined)                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [scrollZoom](#getter-scrollzoom)                             | Getters    | [BaseSessionModel](../basesessionmodel) | resolved scroll-to-zoom preference. Global and personal (never shared in a session snapshot); every wheel-zoom view reads this single value.                                                                                                                                                                                                                                                                                                                                                                           |
| [getPreference](#method-getpreference)                       | Methods    | [BaseSessionModel](../basesessionmodel) | resolved value of a user preference: a runtime override if the user set one, otherwise the admin/embedder `configuration.preferences` default. The override map is empty unless the product loads it (web/desktop).                                                                                                                                                                                                                                                                                                    |
| [getDisplayTypeDefault](#method-getdisplaytypedefault)       | Methods    | [BaseSessionModel](../basesessionmodel) | resolved value of a per-display-type slot default the user promoted (see `setDisplayTypeDefault`); undefined when nothing was promoted.                                                                                                                                                                                                                                                                                                                                                                                |
| [getPreferenceChanges](#method-getpreferencechanges)         | Methods    | [BaseSessionModel](../basesessionmodel) | every runtime preference-override that currently differs from its config/admin default, as `{ path, from, to }` rows — the exact set `clearPreferenceOverrides` reverts. Backs the confirmation diff shown before "Reset to defaults" (mirrors the per-track changes dialog). A scalar pref (animationMode, scrollZoom) whose override equals the default is omitted (reverting it is a no-op); each promoted per-display-type default is always a difference from the un-promoted state, so `from` reads "(default)". |
| [setSelection](#action-setselection)                         | Actions    | [BaseSessionModel](../basesessionmodel) | set the global selection, i.e. the globally-selected object. can be a feature, a view, just about anything                                                                                                                                                                                                                                                                                                                                                                                                             |
| [clearSelection](#action-clearselection)                     | Actions    | [BaseSessionModel](../basesessionmodel) | clears the global selection                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [setHovered](#action-sethovered)                             | Actions    | [BaseSessionModel](../basesessionmodel) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [setHighlightsVisible](#action-sethighlightsvisible)         | Actions    | [BaseSessionModel](../basesessionmodel) | toggle all region highlight bands across every view                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [setPreferenceOverride](#action-setpreferenceoverride)       | Actions    | [BaseSessionModel](../basesessionmodel) | set a runtime user-preference override (see `getPreference`). Mutates volatile state; products persist these to localStorage.                                                                                                                                                                                                                                                                                                                                                                                          |
| [clearPreferenceOverrides](#action-clearpreferenceoverrides) | Actions    | [BaseSessionModel](../basesessionmodel) | clear every runtime preference override at once — scrollZoom, animationMode, and every promoted per-display-type default (see `setDisplayTypeDefault`) — so each falls back to its config/admin default. Backs the Preferences dialog "Reset to defaults" button.                                                                                                                                                                                                                                                      |
| [clearPreferenceOverride](#action-clearpreferenceoverride)   | Actions    | [BaseSessionModel](../basesessionmodel) | clear a single runtime preference override (see `getPreference`) so it falls back to its config/admin default. Backs the per-entry reset in the Preferences dialog "Reset to defaults" confirmation.                                                                                                                                                                                                                                                                                                                   |
| [setScrollZoom](#action-setscrollzoom)                       | Actions    | [BaseSessionModel](../basesessionmodel) | set the global scroll-to-zoom preference (see the `scrollZoom` getter)                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setDisplayTypeDefault](#action-setdisplaytypedefault)       | Actions    | [BaseSessionModel](../basesessionmodel) | promote (or, with `value` undefined, clear) a per-display-type slot default. Stored under `preferencesOverrides.displayTypeDefaults` so the PreferencesSessionMixin persists it to localStorage like other prefs.                                                                                                                                                                                                                                                                                                      |
| [setName](#action-setname)                                   | Actions    | [BaseSessionModel](../basesessionmodel) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [setFocusedViewId](#action-setfocusedviewid)                 | Actions    | [BaseSessionModel](../basesessionmodel) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [removeActiveDialog](#action-removeactivedialog)             | Actions    | [BaseSessionModel](../basesessionmodel) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [queueDialog](#action-queuedialog)                           | Actions    | [BaseSessionModel](../basesessionmodel) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [snackbarMessages](#volatile-snackbarmessages)               | Volatiles  | [SnackbarModel](../snackbarmodel)       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [errorDialog](#volatile-errordialog)                         | Volatiles  | [SnackbarModel](../snackbarmodel)       | the error currently shown in the stack-trace dialog. Kept off the dialog queue so it can stack on top of an already-open dialog (e.g. the one whose action raised the error) instead of waiting behind it                                                                                                                                                                                                                                                                                                              |
| [snackbarMessageSet](#getter-snackbarmessageset)             | Getters    | [SnackbarModel](../snackbarmodel)       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [notify](#action-notify)                                     | Actions    | [SnackbarModel](../snackbarmodel)       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [notifyError](#action-notifyerror)                           | Actions    | [SnackbarModel](../snackbarmodel)       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [setErrorDialog](#action-seterrordialog)                     | Actions    | [SnackbarModel](../snackbarmodel)       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [pushSnackbarMessage](#action-pushsnackbarmessage)           | Actions    | [SnackbarModel](../snackbarmodel)       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [popSnackbarMessage](#action-popsnackbarmessage)             | Actions    | [SnackbarModel](../snackbarmodel)       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [removeSnackbarMessage](#action-removesnackbarmessage)       | Actions    | [SnackbarModel](../snackbarmodel)       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

<details>
<summary>EmbeddedSessionThemeMixin - Getters</summary>

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
