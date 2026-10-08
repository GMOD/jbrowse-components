---
id: embeddedsessionthememixin
title: EmbeddedSessionThemeMixin
description: "Theme getters shared by the single-view embedded sessions (react-linear-genome-view, react-circular-genome-view). Embedded products have no theme picker, so the palette is always default and the…"
sidebar_label: Mixin -> EmbeddedSessionThemeMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/embedded-core/src/EmbeddedSessionThemeMixin.ts).

Theme getters shared by the single-view embedded sessions
(react-linear-genome-view, react-circular-genome-view). Embedded products
have no theme picker, so the palette is always `default` and the config
`theme` slot supplies it; light or dark is the host's to drive, through
`setThemeMode`.

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<span data-pagefind-ignore>From [BaseSessionModel](../basesessionmodel): <span id="property-id">[`id`](../basesessionmodel#property-id)</span>, <span id="property-name">[`name`](../basesessionmodel#property-name)</span>, <span id="property-focusedviewid">[`focusedViewId`](../basesessionmodel#property-focusedviewid)</span>, <span id="property-highlights">[`highlights`](../basesessionmodel#property-highlights)</span>, <span id="property-highlightsvisible">[`highlightsVisible`](../basesessionmodel#property-highlightsvisible)</span>, <span id="property-highlightlabelsvisible">[`highlightLabelsVisible`](../basesessionmodel#property-highlightlabelsvisible)</span>, <span id="property-heldformissingplugins">[`heldForMissingPlugins`](../basesessionmodel#property-heldformissingplugins)</span></span>

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-sessionthememode">**sessionThemeMode**</span><br><code>PaletteMode &#124; undefined</code> |  |

<span data-pagefind-ignore>From [BaseSessionModel](../basesessionmodel): <span id="volatile-selection">[`selection`](../basesessionmodel#volatile-selection)</span>, <span id="volatile-hovered">[`hovered`](../basesessionmodel#volatile-hovered)</span>, <span id="volatile-queueofdialogs">[`queueOfDialogs`](../basesessionmodel#volatile-queueofdialogs)</span>, <span id="volatile-preferencesoverrides">[`preferencesOverrides`](../basesessionmodel#volatile-preferencesoverrides)</span></span>

<span data-pagefind-ignore>From [SnackbarModel](../snackbarmodel): <span id="volatile-snackbarmessages">[`snackbarMessages`](../snackbarmodel#volatile-snackbarmessages)</span>, <span id="volatile-errordialog">[`errorDialog`](../snackbarmodel#volatile-errordialog)</span></span>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-themeoptions">**themeOptions**</span><br><code>SerializableThemeArgs</code> | Serializable theme description (the canonical `themeOptions` contract shared with the app-core/web sessions). This is what crosses the RPC worker boundary — e.g. the canvas display reads `getSession(self).themeOptions` in its rpcProps so worker-baked colors (CDS frames, stroke fallback) honor the config `theme` slot. |
| <span id="getter-palette">**palette**</span><br><code>JBrowsePalette</code> | Every color JBrowse renders, resolved to plain strings and free of any UI toolkit. This is what rendering reads. See the canonical `ThemeManagerSessionMixin` getter of the same name. |
| <span id="getter-styletheme">**styleTheme**</span><br><code>JBrowseStyleTheme</code> | The palette plus the sizing tokens `makeStyles` reads. See the canonical `ThemeManagerSessionMixin` getter of the same name. |
| <span id="getter-theme">**theme**</span><br><code>Theme</code> | Resolved MUI theme, mirroring the product's ThemeProvider. Lets headless/RPC consumers derive theme-dependent state without a mounted component. Shares its colors with `palette` by construction. |

<span data-pagefind-ignore>From [BaseSessionModel](../basesessionmodel): <span id="getter-root">[`root`](../basesessionmodel#getter-root)</span>, <span id="getter-jbrowse">[`jbrowse`](../basesessionmodel#getter-jbrowse)</span>, <span id="getter-rpcmanager">[`rpcManager`](../basesessionmodel#getter-rpcmanager)</span>, <span id="getter-configuration">[`configuration`](../basesessionmodel#getter-configuration)</span>, <span id="getter-adminmode">[`adminMode`](../basesessionmodel#getter-adminmode)</span>, <span id="getter-textsearchmanager">[`textSearchManager`](../basesessionmodel#getter-textsearchmanager)</span>, <span id="getter-assemblies">[`assemblies`](../basesessionmodel#getter-assemblies)</span>, <span id="getter-dialogcomponent">[`DialogComponent`](../basesessionmodel#getter-dialogcomponent)</span>, <span id="getter-dialogprops">[`DialogProps`](../basesessionmodel#getter-dialogprops)</span>, <span id="getter-animationmode">[`animationMode`](../basesessionmodel#getter-animationmode)</span>, <span id="getter-scrollzoom">[`scrollZoom`](../basesessionmodel#getter-scrollzoom)</span>, <span id="getter-numbergrouping">[`numberGrouping`](../basesessionmodel#getter-numbergrouping)</span></span>

<span data-pagefind-ignore>From [SnackbarModel](../snackbarmodel): <span id="getter-snackbarmessageset">[`snackbarMessageSet`](../snackbarmodel#getter-snackbarmessageset)</span></span>

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-getactivethemeoptions">**getActiveThemeOptions**</span><br><code>(_name?: string &#124; undefined) =&gt; ThemeOptions &#124; undefined</code> | Raw `ThemeOptions` for the active theme, which every view's SVG export threads into each display's `renderSvg` as a `configTheme` and rebuilds outside React. The config slot is the whole answer here because it is the whole of an embedded product's theming: no picker, no `allThemes`, and it is what `setThemeMode` writes and `palette` resolves from. `name` is accepted and ignored — the app session's counterpart looks a named preset up in `allThemes()`. |

<span data-pagefind-ignore>From [BaseSessionModel](../basesessionmodel): <span id="method-getpreferencedefault">[`getPreferenceDefault`](../basesessionmodel#method-getpreferencedefault)</span>, <span id="method-getpreference">[`getPreference`](../basesessionmodel#method-getpreference)</span>, <span id="method-getpreferencechanges">[`getPreferenceChanges`](../basesessionmodel#method-getpreferencechanges)</span></span>

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setthememode">**setThemeMode**</span><br><code>(mode: PaletteMode) =&gt; void</code> | Switch the session to light or dark, leaving the host's configured colours alone. `themeOptions` carries the mode to the renderer, so labels drawn in the worker follow it, and `palette` is derived from the same args, so React-drawn elements follow it too. An embedder who sets only a React-side palette leaves the worker-drawn labels in the old mode.<br><br>This used to write `palette.mode` into the config `theme` slot, which meant merging at two levels to avoid discarding the brand the host had passed to `createViewState`. Mode is its own axis now, so there is nothing to merge and nothing to discard. |

<span data-pagefind-ignore>From [BaseSessionModel](../basesessionmodel): <span id="action-setselection">[`setSelection`](../basesessionmodel#action-setselection)</span>, <span id="action-clearselection">[`clearSelection`](../basesessionmodel#action-clearselection)</span>, <span id="action-sethovered">[`setHovered`](../basesessionmodel#action-sethovered)</span>, <span id="action-sethighlightsvisible">[`setHighlightsVisible`](../basesessionmodel#action-sethighlightsvisible)</span>, <span id="action-sethighlightlabelsvisible">[`setHighlightLabelsVisible`](../basesessionmodel#action-sethighlightlabelsvisible)</span>, <span id="action-addhighlight">[`addHighlight`](../basesessionmodel#action-addhighlight)</span>, <span id="action-removehighlight">[`removeHighlight`](../basesessionmodel#action-removehighlight)</span>, <span id="action-updatehighlight">[`updateHighlight`](../basesessionmodel#action-updatehighlight)</span>, <span id="action-sethighlights">[`setHighlights`](../basesessionmodel#action-sethighlights)</span>, <span id="action-setpreferenceoverride">[`setPreferenceOverride`](../basesessionmodel#action-setpreferenceoverride)</span>, <span id="action-clearpreferenceoverrides">[`clearPreferenceOverrides`](../basesessionmodel#action-clearpreferenceoverrides)</span>, <span id="action-clearpreferenceoverride">[`clearPreferenceOverride`](../basesessionmodel#action-clearpreferenceoverride)</span>, <span id="action-setscrollzoom">[`setScrollZoom`](../basesessionmodel#action-setscrollzoom)</span>, <span id="action-setname">[`setName`](../basesessionmodel#action-setname)</span>, <span id="action-setfocusedviewid">[`setFocusedViewId`](../basesessionmodel#action-setfocusedviewid)</span>, <span id="action-removeactivedialog">[`removeActiveDialog`](../basesessionmodel#action-removeactivedialog)</span>, <span id="action-queuedialog">[`queueDialog`](../basesessionmodel#action-queuedialog)</span>, <span id="action-removedialog">[`removeDialog`](../basesessionmodel#action-removedialog)</span></span>

<span data-pagefind-ignore>From [SnackbarModel](../snackbarmodel): <span id="action-notify">[`notify`](../snackbarmodel#action-notify)</span>, <span id="action-notifyerror">[`notifyError`](../snackbarmodel#action-notifyerror)</span>, <span id="action-seterrordialog">[`setErrorDialog`](../snackbarmodel#action-seterrordialog)</span>, <span id="action-pushsnackbarmessage">[`pushSnackbarMessage`](../snackbarmodel#action-pushsnackbarmessage)</span>, <span id="action-popsnackbarmessage">[`popSnackbarMessage`](../snackbarmodel#action-popsnackbarmessage)</span>, <span id="action-removesnackbarmessage">[`removeSnackbarMessage`](../snackbarmodel#action-removesnackbarmessage)</span></span>
