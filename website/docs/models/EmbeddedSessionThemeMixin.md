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

| Member                               | Kind    | Description                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [themeOptions](#getter-themeoptions) | Getters | Serializable theme description (the canonical `themeOptions` contract shared with the app-core/web sessions). This is what crosses the RPC worker boundary — e.g. the canvas display reads `getSession(self).themeOptions` in its rpcProps so worker-baked colors (CDS frames, stroke fallback) honor the config `theme` slot. |
| [theme](#getter-theme)               | Getters | Resolved MUI theme, mirroring the product's ThemeProvider. Lets headless/RPC consumers derive theme-dependent state without a mounted component.                                                                                                                                                                               |

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

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
