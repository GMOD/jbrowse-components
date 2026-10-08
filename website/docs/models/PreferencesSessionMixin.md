---
id: preferencessessionmixin
title: PreferencesSessionMixin
description: "loads and persists user-preference overrides (the BaseSession preferencesOverrides volatile) to localStorage. Compose into products that let users edit preferences (web, desktop); embedded sessions…"
sidebar_label: Mixin -> PreferencesSessionMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/Preferences.ts).

loads and persists user-preference overrides (the BaseSession
`preferencesOverrides` volatile) to localStorage. Compose into products that
let users edit preferences (web, desktop); embedded sessions omit it and
resolve preferences from `configuration.preferences` admin defaults only.

PreferencesSessionMixin declares no members of its own — it composes the models below, and everything here is theirs.

## Properties

<span data-pagefind-ignore>From [BaseSessionModel](../basesessionmodel): <span id="property-id">[`id`](../basesessionmodel#property-id)</span>, <span id="property-name">[`name`](../basesessionmodel#property-name)</span>, <span id="property-focusedviewid">[`focusedViewId`](../basesessionmodel#property-focusedviewid)</span>, <span id="property-highlights">[`highlights`](../basesessionmodel#property-highlights)</span>, <span id="property-highlightsvisible">[`highlightsVisible`](../basesessionmodel#property-highlightsvisible)</span>, <span id="property-highlightlabelsvisible">[`highlightLabelsVisible`](../basesessionmodel#property-highlightlabelsvisible)</span>, <span id="property-heldformissingplugins">[`heldForMissingPlugins`](../basesessionmodel#property-heldformissingplugins)</span></span>

## Volatiles

<span data-pagefind-ignore>From [BaseSessionModel](../basesessionmodel): <span id="volatile-selection">[`selection`](../basesessionmodel#volatile-selection)</span>, <span id="volatile-hovered">[`hovered`](../basesessionmodel#volatile-hovered)</span>, <span id="volatile-queueofdialogs">[`queueOfDialogs`](../basesessionmodel#volatile-queueofdialogs)</span>, <span id="volatile-preferencesoverrides">[`preferencesOverrides`](../basesessionmodel#volatile-preferencesoverrides)</span></span>

<span data-pagefind-ignore>From [SnackbarModel](../snackbarmodel): <span id="volatile-snackbarmessages">[`snackbarMessages`](../snackbarmodel#volatile-snackbarmessages)</span>, <span id="volatile-errordialog">[`errorDialog`](../snackbarmodel#volatile-errordialog)</span></span>

## Getters

<span data-pagefind-ignore>From [BaseSessionModel](../basesessionmodel): <span id="getter-root">[`root`](../basesessionmodel#getter-root)</span>, <span id="getter-jbrowse">[`jbrowse`](../basesessionmodel#getter-jbrowse)</span>, <span id="getter-rpcmanager">[`rpcManager`](../basesessionmodel#getter-rpcmanager)</span>, <span id="getter-configuration">[`configuration`](../basesessionmodel#getter-configuration)</span>, <span id="getter-adminmode">[`adminMode`](../basesessionmodel#getter-adminmode)</span>, <span id="getter-textsearchmanager">[`textSearchManager`](../basesessionmodel#getter-textsearchmanager)</span>, <span id="getter-assemblies">[`assemblies`](../basesessionmodel#getter-assemblies)</span>, <span id="getter-dialogcomponent">[`DialogComponent`](../basesessionmodel#getter-dialogcomponent)</span>, <span id="getter-dialogprops">[`DialogProps`](../basesessionmodel#getter-dialogprops)</span>, <span id="getter-animationmode">[`animationMode`](../basesessionmodel#getter-animationmode)</span>, <span id="getter-scrollzoom">[`scrollZoom`](../basesessionmodel#getter-scrollzoom)</span>, <span id="getter-numbergrouping">[`numberGrouping`](../basesessionmodel#getter-numbergrouping)</span></span>

<span data-pagefind-ignore>From [SnackbarModel](../snackbarmodel): <span id="getter-snackbarmessageset">[`snackbarMessageSet`](../snackbarmodel#getter-snackbarmessageset)</span></span>

## Methods

<span data-pagefind-ignore>From [BaseSessionModel](../basesessionmodel): <span id="method-getpreferencedefault">[`getPreferenceDefault`](../basesessionmodel#method-getpreferencedefault)</span>, <span id="method-getpreference">[`getPreference`](../basesessionmodel#method-getpreference)</span>, <span id="method-getpreferencechanges">[`getPreferenceChanges`](../basesessionmodel#method-getpreferencechanges)</span></span>

## Actions

<span data-pagefind-ignore>From [BaseSessionModel](../basesessionmodel): <span id="action-setselection">[`setSelection`](../basesessionmodel#action-setselection)</span>, <span id="action-clearselection">[`clearSelection`](../basesessionmodel#action-clearselection)</span>, <span id="action-sethovered">[`setHovered`](../basesessionmodel#action-sethovered)</span>, <span id="action-sethighlightsvisible">[`setHighlightsVisible`](../basesessionmodel#action-sethighlightsvisible)</span>, <span id="action-sethighlightlabelsvisible">[`setHighlightLabelsVisible`](../basesessionmodel#action-sethighlightlabelsvisible)</span>, <span id="action-addhighlight">[`addHighlight`](../basesessionmodel#action-addhighlight)</span>, <span id="action-removehighlight">[`removeHighlight`](../basesessionmodel#action-removehighlight)</span>, <span id="action-updatehighlight">[`updateHighlight`](../basesessionmodel#action-updatehighlight)</span>, <span id="action-sethighlights">[`setHighlights`](../basesessionmodel#action-sethighlights)</span>, <span id="action-setpreferenceoverride">[`setPreferenceOverride`](../basesessionmodel#action-setpreferenceoverride)</span>, <span id="action-clearpreferenceoverrides">[`clearPreferenceOverrides`](../basesessionmodel#action-clearpreferenceoverrides)</span>, <span id="action-clearpreferenceoverride">[`clearPreferenceOverride`](../basesessionmodel#action-clearpreferenceoverride)</span>, <span id="action-setscrollzoom">[`setScrollZoom`](../basesessionmodel#action-setscrollzoom)</span>, <span id="action-setname">[`setName`](../basesessionmodel#action-setname)</span>, <span id="action-setfocusedviewid">[`setFocusedViewId`](../basesessionmodel#action-setfocusedviewid)</span>, <span id="action-removeactivedialog">[`removeActiveDialog`](../basesessionmodel#action-removeactivedialog)</span>, <span id="action-queuedialog">[`queueDialog`](../basesessionmodel#action-queuedialog)</span>, <span id="action-removedialog">[`removeDialog`](../basesessionmodel#action-removedialog)</span></span>

<span data-pagefind-ignore>From [SnackbarModel](../snackbarmodel): <span id="action-notify">[`notify`](../snackbarmodel#action-notify)</span>, <span id="action-notifyerror">[`notifyError`](../snackbarmodel#action-notifyerror)</span>, <span id="action-seterrordialog">[`setErrorDialog`](../snackbarmodel#action-seterrordialog)</span>, <span id="action-pushsnackbarmessage">[`pushSnackbarMessage`](../snackbarmodel#action-pushsnackbarmessage)</span>, <span id="action-popsnackbarmessage">[`popSnackbarMessage`](../snackbarmodel#action-popsnackbarmessage)</span>, <span id="action-removesnackbarmessage">[`removeSnackbarMessage`](../snackbarmodel#action-removesnackbarmessage)</span></span>
