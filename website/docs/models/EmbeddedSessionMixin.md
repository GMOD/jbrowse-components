---
id: embeddedsessionmixin
title: EmbeddedSessionMixin
description: "Everything the two single-view embedded products' sessions (react-linear-genome-view, react-circular-genome-view) share: the mixin set they compose and the three getters that read the root model. The…"
sidebar_label: Mixin -> EmbeddedSessionMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/embedded-core/src/EmbeddedSessionMixin.ts).

Everything the two single-view embedded products' sessions
(react-linear-genome-view, react-circular-genome-view) share: the mixin set
they compose and the three getters that read the root model. The twin of
createEmbeddedRootModel one level down.

Each product composes this mixin. A factory taking the product's view type
and tracks mixin as parameters does not typecheck usefully:
`types.compose`'s overloads are declared over `IModelType<P, O, FC, FS>`, so
a model passed as a naked type parameter gives nothing to infer those four
from, and `session.view` becomes `any` at every embedder call site with no
type error. Passing only concrete types to `compose` keeps the products'
views typed.

Each product therefore declares its tracks mixin, `view` prop, and the
`views`/`addView`/`removeView` members that read `self.view`, because those
members need its concrete view type.

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<span data-pagefind-ignore>From [BaseSessionModel](../basesessionmodel): <span id="property-id">[`id`](../basesessionmodel#property-id)</span>, <span id="property-name">[`name`](../basesessionmodel#property-name)</span>, <span id="property-focusedviewid">[`focusedViewId`](../basesessionmodel#property-focusedviewid)</span>, <span id="property-highlights">[`highlights`](../basesessionmodel#property-highlights)</span>, <span id="property-highlightsvisible">[`highlightsVisible`](../basesessionmodel#property-highlightsvisible)</span>, <span id="property-highlightlabelsvisible">[`highlightLabelsVisible`](../basesessionmodel#property-highlightlabelsvisible)</span>, <span id="property-heldformissingplugins">[`heldForMissingPlugins`](../basesessionmodel#property-heldformissingplugins)</span></span>

<span data-pagefind-ignore>From [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin): <span id="property-drawerposition">[`drawerPosition`](../drawerwidgetsessionmixin#property-drawerposition)</span>, <span id="property-drawerwidth">[`drawerWidth`](../drawerwidgetsessionmixin#property-drawerwidth)</span>, <span id="property-widgets">[`widgets`](../drawerwidgetsessionmixin#property-widgets)</span>, <span id="property-activewidgets">[`activeWidgets`](../drawerwidgetsessionmixin#property-activewidgets)</span>, <span id="property-minimized">[`minimized`](../drawerwidgetsessionmixin#property-minimized)</span></span>

<span data-pagefind-ignore>From [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin): <span id="property-connectioninstances">[`connectionInstances`](../connectionmanagementsessionmixin#property-connectioninstances)</span>, <span id="property-connectiontrackconfigs">[`connectionTrackConfigs`](../connectionmanagementsessionmixin#property-connectiontrackconfigs)</span></span>

## Volatiles

<span data-pagefind-ignore>From [BaseSessionModel](../basesessionmodel): <span id="volatile-selection">[`selection`](../basesessionmodel#volatile-selection)</span>, <span id="volatile-hovered">[`hovered`](../basesessionmodel#volatile-hovered)</span>, <span id="volatile-queueofdialogs">[`queueOfDialogs`](../basesessionmodel#volatile-queueofdialogs)</span>, <span id="volatile-preferencesoverrides">[`preferencesOverrides`](../basesessionmodel#volatile-preferencesoverrides)</span></span>

<span data-pagefind-ignore>From [SnackbarModel](../snackbarmodel): <span id="volatile-snackbarmessages">[`snackbarMessages`](../snackbarmodel#volatile-snackbarmessages)</span>, <span id="volatile-errordialog">[`errorDialog`](../snackbarmodel#volatile-errordialog)</span></span>

<span data-pagefind-ignore>From [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin): <span id="volatile-poppedout">[`poppedOut`](../drawerwidgetsessionmixin#volatile-poppedout)</span>, <span id="volatile-modalwidgets">[`modalWidgets`](../drawerwidgetsessionmixin#volatile-modalwidgets)</span></span>

<span data-pagefind-ignore>From [EmbeddedSessionThemeMixin](../embeddedsessionthememixin): <span id="volatile-sessionthememode">[`sessionThemeMode`](../embeddedsessionthememixin#volatile-sessionthememode)</span></span>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-viewtitlebars">**viewTitleBars**</span><br><code>boolean</code> | An embedded view is drawn with no title bar above it, so its menu lives in the view's own controls. |
| <span id="getter-version">**version**</span><br><code>string</code> |  |
| <span id="getter-assemblynames">**assemblyNames**</span><br><code>string[]</code> |  |
| <span id="getter-assemblymanager">**assemblyManager**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; { aft…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; { afterAttach(): void; removeAssembly(asm: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; IStateTreeNode&lt;…&gt;): void; addAssembly(configuration: any): void; } &amp; IStateTreeNode&lt;…&gt;</code></pre></dialog></span> |  |

<span data-pagefind-ignore>From [BaseSessionModel](../basesessionmodel): <span id="getter-root">[`root`](../basesessionmodel#getter-root)</span>, <span id="getter-jbrowse">[`jbrowse`](../basesessionmodel#getter-jbrowse)</span>, <span id="getter-rpcmanager">[`rpcManager`](../basesessionmodel#getter-rpcmanager)</span>, <span id="getter-configuration">[`configuration`](../basesessionmodel#getter-configuration)</span>, <span id="getter-adminmode">[`adminMode`](../basesessionmodel#getter-adminmode)</span>, <span id="getter-textsearchmanager">[`textSearchManager`](../basesessionmodel#getter-textsearchmanager)</span>, <span id="getter-assemblies">[`assemblies`](../basesessionmodel#getter-assemblies)</span>, <span id="getter-dialogcomponent">[`DialogComponent`](../basesessionmodel#getter-dialogcomponent)</span>, <span id="getter-dialogprops">[`DialogProps`](../basesessionmodel#getter-dialogprops)</span>, <span id="getter-animationmode">[`animationMode`](../basesessionmodel#getter-animationmode)</span>, <span id="getter-scrollzoom">[`scrollZoom`](../basesessionmodel#getter-scrollzoom)</span>, <span id="getter-numbergrouping">[`numberGrouping`](../basesessionmodel#getter-numbergrouping)</span></span>

<span data-pagefind-ignore>From [SnackbarModel](../snackbarmodel): <span id="getter-snackbarmessageset">[`snackbarMessageSet`](../snackbarmodel#getter-snackbarmessageset)</span></span>

<span data-pagefind-ignore>From [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin): <span id="getter-visiblewidget">[`visibleWidget`](../drawerwidgetsessionmixin#getter-visiblewidget)</span>, <span id="getter-drawervisible">[`drawerVisible`](../drawerwidgetsessionmixin#getter-drawervisible)</span>, <span id="getter-modalwidgetvisible">[`modalWidgetVisible`](../drawerwidgetsessionmixin#getter-modalwidgetvisible)</span></span>

<span data-pagefind-ignore>From [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin): <span id="getter-connections">[`connections`](../connectionmanagementsessionmixin#getter-connections)</span></span>

<span data-pagefind-ignore>From [EmbeddedSessionThemeMixin](../embeddedsessionthememixin): <span id="getter-themeoptions">[`themeOptions`](../embeddedsessionthememixin#getter-themeoptions)</span>, <span id="getter-palette">[`palette`](../embeddedsessionthememixin#getter-palette)</span>, <span id="getter-styletheme">[`styleTheme`](../embeddedsessionthememixin#getter-styletheme)</span>, <span id="getter-theme">[`theme`](../embeddedsessionthememixin#getter-theme)</span></span>

## Methods

<span data-pagefind-ignore>From [BaseSessionModel](../basesessionmodel): <span id="method-getpreferencedefault">[`getPreferenceDefault`](../basesessionmodel#method-getpreferencedefault)</span>, <span id="method-getpreference">[`getPreference`](../basesessionmodel#method-getpreference)</span>, <span id="method-getpreferencechanges">[`getPreferenceChanges`](../basesessionmodel#method-getpreferencechanges)</span></span>

<span data-pagefind-ignore>From [ReferenceManagementSessionMixin](../referencemanagementsessionmixin): <span id="method-getreferringmultiple">[`getReferringMultiple`](../referencemanagementsessionmixin#method-getreferringmultiple)</span>, <span id="method-getreferring">[`getReferring`](../referencemanagementsessionmixin#method-getreferring)</span></span>

<span data-pagefind-ignore>From [TrackMenuSessionMixin](../trackmenusessionmixin): <span id="method-gettracklistmenuitems">[`getTrackListMenuItems`](../trackmenusessionmixin#method-gettracklistmenuitems)</span>, <span id="method-gettrackactionmenuitems">[`getTrackActionMenuItems`](../trackmenusessionmixin#method-gettrackactionmenuitems)</span></span>

<span data-pagefind-ignore>From [EmbeddedSessionThemeMixin](../embeddedsessionthememixin): <span id="method-getactivethemeoptions">[`getActiveThemeOptions`](../embeddedsessionthememixin#method-getactivethemeoptions)</span></span>

## Actions

<span data-pagefind-ignore>From [BaseSessionModel](../basesessionmodel): <span id="action-setselection">[`setSelection`](../basesessionmodel#action-setselection)</span>, <span id="action-clearselection">[`clearSelection`](../basesessionmodel#action-clearselection)</span>, <span id="action-sethovered">[`setHovered`](../basesessionmodel#action-sethovered)</span>, <span id="action-sethighlightsvisible">[`setHighlightsVisible`](../basesessionmodel#action-sethighlightsvisible)</span>, <span id="action-sethighlightlabelsvisible">[`setHighlightLabelsVisible`](../basesessionmodel#action-sethighlightlabelsvisible)</span>, <span id="action-addhighlight">[`addHighlight`](../basesessionmodel#action-addhighlight)</span>, <span id="action-removehighlight">[`removeHighlight`](../basesessionmodel#action-removehighlight)</span>, <span id="action-updatehighlight">[`updateHighlight`](../basesessionmodel#action-updatehighlight)</span>, <span id="action-sethighlights">[`setHighlights`](../basesessionmodel#action-sethighlights)</span>, <span id="action-setpreferenceoverride">[`setPreferenceOverride`](../basesessionmodel#action-setpreferenceoverride)</span>, <span id="action-clearpreferenceoverrides">[`clearPreferenceOverrides`](../basesessionmodel#action-clearpreferenceoverrides)</span>, <span id="action-clearpreferenceoverride">[`clearPreferenceOverride`](../basesessionmodel#action-clearpreferenceoverride)</span>, <span id="action-setscrollzoom">[`setScrollZoom`](../basesessionmodel#action-setscrollzoom)</span>, <span id="action-setname">[`setName`](../basesessionmodel#action-setname)</span>, <span id="action-setfocusedviewid">[`setFocusedViewId`](../basesessionmodel#action-setfocusedviewid)</span>, <span id="action-removeactivedialog">[`removeActiveDialog`](../basesessionmodel#action-removeactivedialog)</span>, <span id="action-queuedialog">[`queueDialog`](../basesessionmodel#action-queuedialog)</span>, <span id="action-removedialog">[`removeDialog`](../basesessionmodel#action-removedialog)</span></span>

<span data-pagefind-ignore>From [SnackbarModel](../snackbarmodel): <span id="action-notify">[`notify`](../snackbarmodel#action-notify)</span>, <span id="action-notifyerror">[`notifyError`](../snackbarmodel#action-notifyerror)</span>, <span id="action-seterrordialog">[`setErrorDialog`](../snackbarmodel#action-seterrordialog)</span>, <span id="action-pushsnackbarmessage">[`pushSnackbarMessage`](../snackbarmodel#action-pushsnackbarmessage)</span>, <span id="action-popsnackbarmessage">[`popSnackbarMessage`](../snackbarmodel#action-popsnackbarmessage)</span>, <span id="action-removesnackbarmessage">[`removeSnackbarMessage`](../snackbarmodel#action-removesnackbarmessage)</span></span>

<span data-pagefind-ignore>From [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin): <span id="action-setdrawerposition">[`setDrawerPosition`](../drawerwidgetsessionmixin#action-setdrawerposition)</span>, <span id="action-updatedrawerwidth">[`updateDrawerWidth`](../drawerwidgetsessionmixin#action-updatedrawerwidth)</span>, <span id="action-resizedrawer">[`resizeDrawer`](../drawerwidgetsessionmixin#action-resizedrawer)</span>, <span id="action-addwidget">[`addWidget`](../drawerwidgetsessionmixin#action-addwidget)</span>, <span id="action-showwidget">[`showWidget`](../drawerwidgetsessionmixin#action-showwidget)</span>, <span id="action-hidewidget">[`hideWidget`](../drawerwidgetsessionmixin#action-hidewidget)</span>, <span id="action-minimizewidgetdrawer">[`minimizeWidgetDrawer`](../drawerwidgetsessionmixin#action-minimizewidgetdrawer)</span>, <span id="action-showwidgetdrawer">[`showWidgetDrawer`](../drawerwidgetsessionmixin#action-showwidgetdrawer)</span>, <span id="action-popoutwidget">[`popoutWidget`](../drawerwidgetsessionmixin#action-popoutwidget)</span>, <span id="action-returnwidgettodrawer">[`returnWidgetToDrawer`](../drawerwidgetsessionmixin#action-returnwidgettodrawer)</span>, <span id="action-setmodalwidgets">[`setModalWidgets`](../drawerwidgetsessionmixin#action-setmodalwidgets)</span>, <span id="action-hideallwidgets">[`hideAllWidgets`](../drawerwidgetsessionmixin#action-hideallwidgets)</span>, <span id="action-closemodalwidget">[`closeModalWidget`](../drawerwidgetsessionmixin#action-closemodalwidget)</span>, <span id="action-openwidget">[`openWidget`](../drawerwidgetsessionmixin#action-openwidget)</span>, <span id="action-editconfiguration">[`editConfiguration`](../drawerwidgetsessionmixin#action-editconfiguration)</span></span>

<span data-pagefind-ignore>From [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin): <span id="action-makeconnection">[`makeConnection`](../connectionmanagementsessionmixin#action-makeconnection)</span>, <span id="action-breakconnection">[`breakConnection`](../connectionmanagementsessionmixin#action-breakconnection)</span>, <span id="action-teardownconnection">[`teardownConnection`](../connectionmanagementsessionmixin#action-teardownconnection)</span>, <span id="action-deleteconnection">[`deleteConnection`](../connectionmanagementsessionmixin#action-deleteconnection)</span>, <span id="action-addconnectionconf">[`addConnectionConf`](../connectionmanagementsessionmixin#action-addconnectionconf)</span>, <span id="action-clearconnections">[`clearConnections`](../connectionmanagementsessionmixin#action-clearconnections)</span>, <span id="action-captureconnectiontrack">[`captureConnectionTrack`](../connectionmanagementsessionmixin#action-captureconnectiontrack)</span>, <span id="action-updateconnectiontrackconfig">[`updateConnectionTrackConfig`](../connectionmanagementsessionmixin#action-updateconnectiontrackconfig)</span>, <span id="action-setconnectiontrackconfig">[`setConnectionTrackConfig`](../connectionmanagementsessionmixin#action-setconnectiontrackconfig)</span>, <span id="action-pruneconnectiontrackconfig">[`pruneConnectionTrackConfig`](../connectionmanagementsessionmixin#action-pruneconnectiontrackconfig)</span>, <span id="action-hydrateconnection">[`hydrateConnection`](../connectionmanagementsessionmixin#action-hydrateconnection)</span></span>

<span data-pagefind-ignore>From [ReferenceManagementSessionMixin](../referencemanagementsessionmixin): <span id="action-dereferencetrack">[`dereferenceTrack`](../referencemanagementsessionmixin#action-dereferencetrack)</span></span>

<span data-pagefind-ignore>From [EmbeddedSessionThemeMixin](../embeddedsessionthememixin): <span id="action-setthememode">[`setThemeMode`](../embeddedsessionthememixin#action-setthememode)</span></span>
