---
id: drawerwidgetsessionmixin
title: DrawerWidgetSessionMixin
description: "Adds the widget drawer to a session: the open widgets, which one is showing, and the drawer's side, width and minimized state."
sidebar_label: Mixin -> DrawerWidgetSessionMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source. See the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/DrawerWidgets.ts).

Adds the widget drawer to a session: the open widgets, which one is
showing, and the drawer's side, width and minimized state.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-drawerposition">**drawerPosition**</span><br><code>DrawerPosition</code> · default <code>storedDrawerPosition()</code> |  |
| <span id="property-drawerwidth">**drawerWidth**</span><br><code>number</code> · default <code>384</code> |  |
| <span id="property-widgets">**widgets**</span><br><code>Map&lt;string, Widget&gt;</code> · default <code>{}</code> |  |
| <span id="property-activewidgets">**activeWidgets**</span><br><code>Map&lt;string, Widget &#124; undefined&gt;</code> · default <code>{}</code> |  |
| <span id="property-minimized">**minimized**</span><br><code>boolean</code> · default <code>false</code> |  |

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-poppedout">**poppedOut**</span><br><code>boolean</code> | true while the visible widget is shown in a modal dialog instead of the drawer. Volatile because a restored session that opened straight into a modal, with no drawer behind it, is disorienting |
| <span id="volatile-modalwidgets">**modalWidgets**</span><br><code>boolean</code> | set by a host with no room for a drawer column beside its views (a phone), so every widget shows in a modal instead |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-visiblewidget">**visibleWidget**</span><br><code>Widget &#124; undefined</code> |  |
| <span id="getter-drawervisible">**drawerVisible**</span><br><code>boolean</code> | whether the drawer column is on screen: there is something to show, it is not minimized to the FAB, and it is not currently a modal instead.<br><br>A getter rather than each host's own `&&`, because the hosts drifted -- the app shell tested `poppedOut` and the embedded view did not, so the day a popout button reaches the embedded drawer header it would render the modal and the drawer at once. |
| <span id="getter-effectivedrawerwidth">**effectiveDrawerWidth**</span><br><code>number</code> | the visible widget's preferred width while it has one, else the saved `drawerWidth`, which a wide mode therefore never overwrites |
| <span id="getter-modalwidgetvisible">**modalWidgetVisible**</span><br><code>boolean</code> | whether the visible widget shows in a modal: popped out of the drawer, or on a host with no room for one |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setdrawerposition">**setDrawerPosition**</span><br><code>(arg: DrawerPosition) =&gt; void</code> |  |
| <span id="action-updatedrawerwidth">**updateDrawerWidth**</span><br><code>(drawerWidth: number, availableWidth?: number) =&gt; number</code> |  |
| <span id="action-resizedrawer">**resizeDrawer**</span><br><code>(distance: number, availableWidth?: number) =&gt; number</code> |  |
| <span id="action-addwidget">**addWidget**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(typeName, id, initialState?, conf?) =&gt; Widget</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(typeName: string, id: string, initialState?: {}, conf?: unknown) =&gt; Widget</code></pre></dialog></span> |  |
| <span id="action-showwidget">**showWidget**</span><br><code>(widget: Widget) =&gt; void</code> |  |
| <span id="action-hidewidget">**hideWidget**</span><br><code>(widget: Widget) =&gt; void</code> | closes the widget, and removes it from the session when its type sets `discardOnClose`. Minimizing the drawer is not closing. |
| <span id="action-minimizewidgetdrawer">**minimizeWidgetDrawer**</span><br><code>() =&gt; void</code> |  |
| <span id="action-showwidgetdrawer">**showWidgetDrawer**</span><br><code>() =&gt; void</code> |  |
| <span id="action-popoutwidget">**popoutWidget**</span><br><code>() =&gt; void</code> | show the visible widget in a modal dialog, freeing the drawer column |
| <span id="action-returnwidgettodrawer">**returnWidgetToDrawer**</span><br><code>() =&gt; void</code> |  |
| <span id="action-setmodalwidgets">**setModalWidgets**</span><br><code>(flag: boolean) =&gt; void</code> |  |
| <span id="action-hideallwidgets">**hideAllWidgets**</span><br><code>() =&gt; void</code> |  |
| <span id="action-closemodalwidget">**closeModalWidget**</span><br><code>() =&gt; void</code> | the modal's close button: a popped-out widget goes back to the drawer, and with no drawer to go back to the widget closes |
| <span id="action-openwidget">**openWidget**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(typeName, id, initialState?, conf?) =&gt; Widget</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(typeName: string, id: string, initialState?: {}, conf?: unknown) =&gt; Widget</code></pre></dialog></span> | adds the widget, replacing one with the same id, and shows it |
| <span id="action-editconfiguration">**editConfiguration**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(configuration: AnyConfigurationModel &#124; {…}, opts?: {…}) =&gt; void</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(configuration: AnyConfigurationModel &#124; { trackId: string; }, opts?: { expandedDisplayId?: string; }) =&gt; void</code></pre></dialog></span> | opens a configuration editor to configure the given thing, and sets the current task to be configuring it |
