---
id: drawerwidgetsessionmixin
title: DrawerWidgetSessionMixin
sidebar_label: Mixin -> DrawerWidgetSessionMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/DrawerWidgets.ts).

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-drawerposition">**drawerPosition**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>drawerPosition: types.optional( types.enumeration&lt;DrawerPositio…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>drawerPosition: types.optional(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.enumeration&lt;DrawerPosition&gt;('DrawerPosition', [&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;...drawerPositions,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;]),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;storedDrawerPosition,&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  |
| <span id="property-drawerwidth">**drawerWidth**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>drawerWidth: types.stripDefault( types.refinement(types.integer…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>drawerWidth: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.refinement(types.integer, width =&gt; width &gt;= minDrawerWidth),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;384,&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  |
| <span id="property-widgets">**widgets**</span><br><code>widgets: types.stripDefault(types.map(widgetStateModelType), {})</code> |  |
| <span id="property-activewidgets">**activeWidgets**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>activeWidgets: types.stripDefault( types.map(types.safeReferenc…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>activeWidgets: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.map(types.safeReference(widgetStateModelType)),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;{},&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  |
| <span id="property-minimized">**minimized**</span><br><code>minimized: types.stripDefault(types.boolean, false)</code> |  |

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-poppedout">**poppedOut**</span><br><code>poppedOut: false</code> | true while the visible widget is shown in a modal dialog instead of the drawer. Volatile because a restored session that opened straight into a modal, with no drawer behind it, is disorienting |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-visiblewidget">**visibleWidget**</span><br><code>Widget &#124; undefined</code> |  |
| <span id="getter-drawervisible">**drawerVisible**</span><br><code>boolean</code> | whether the drawer column is on screen: there is something to show, it is not minimized to the FAB, and it is not currently a modal instead.<br><br>A getter rather than each host's own `&&`, because the hosts drifted -- the app shell tested `poppedOut` and the embedded view did not, so the day a popout button reaches the embedded drawer header it would render the modal and the drawer at once. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setdrawerposition">**setDrawerPosition**</span><br><code>(arg: DrawerPosition) =&gt; void</code> |  |
| <span id="action-updatedrawerwidth">**updateDrawerWidth**</span><br><code>(drawerWidth: number, availableWidth?: number) =&gt; number</code> |  |
| <span id="action-resizedrawer">**resizeDrawer**</span><br><code>(distance: number, availableWidth?: number) =&gt; number</code> |  |
| <span id="action-addwidget">**addWidget**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(typeName: string, id: string, initialState?: any, conf?: unkno…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(typeName: string, id: string, initialState?: any, conf?: unknown) =&gt; any</code></pre></dialog></span> |  |
| <span id="action-showwidget">**showWidget**</span><br><code>(widget: any) =&gt; void</code> |  |
| <span id="action-hidewidget">**hideWidget**</span><br><code>(widget: any) =&gt; void</code> |  |
| <span id="action-minimizewidgetdrawer">**minimizeWidgetDrawer**</span><br><code>() =&gt; void</code> |  |
| <span id="action-showwidgetdrawer">**showWidgetDrawer**</span><br><code>() =&gt; void</code> |  |
| <span id="action-popoutwidget">**popoutWidget**</span><br><code>() =&gt; void</code> | show the visible widget in a modal dialog, freeing the drawer column |
| <span id="action-returnwidgettodrawer">**returnWidgetToDrawer**</span><br><code>() =&gt; void</code> |  |
| <span id="action-hideallwidgets">**hideAllWidgets**</span><br><code>() =&gt; void</code> |  |
| <span id="action-editconfiguration">**editConfiguration**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(configuration: (ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNo…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(configuration: (ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;…&gt;) &#124; { ...; }, opts?: { ...; } &#124; undefined) =&gt; void</code></pre></dialog></span> | opens a configuration editor to configure the given thing, and sets the current task to be configuring it |
