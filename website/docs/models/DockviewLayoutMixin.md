---
id: dockviewlayoutmixin
title: DockviewLayoutMixin
sidebar_label: Mixin -> DockviewLayoutMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/DockviewLayout/index.ts).

Session mixin that persists dockview layout state. Each dockview panel can
contain multiple views stacked vertically.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-dockviewlayout">**dockviewLayout**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>dockviewLayout: types.stripDefault( types.maybe(types.frozen&lt;Se…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>dockviewLayout: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.maybe(types.frozen&lt;SerializedDockview&gt;()),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;undefined,&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | Serialized dockview layout state |
| <span id="property-panelviewassignments">**panelViewAssignments**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>panelViewAssignments: types.stripDefault( types.map(types.array…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>panelViewAssignments: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.map(types.array(types.string)),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;{},&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | Which panel each view is in, as panelId -> viewIds.<br><br>Membership only. The ORDER views render in is `session.views`, in both layout modes (see getViewsForPanel), so this array's order carries no meaning and nothing should read it as one. Two arrays each claiming to be the order is what made "move this view up" need two implementations. |
| <span id="property-activepanelid">**activePanelId**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>activePanelId: types.stripDefault(types.maybe(types.string), un…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>activePanelId: types.stripDefault(types.maybe(types.string), undefined)</code></pre></dialog></span> | The currently active panel ID in dockview |
| <span id="property-init">**init**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>init: types.stripDefault( types.maybe(types.frozen&lt;DockviewLayo…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>init: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.maybe(types.frozen&lt;DockviewLayoutNode&gt;()),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;undefined,&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | The layout to (re)build dockview from, in the simple viewIds/ direction/size form rather than the verbose `dockviewLayout` dockview emits. The single "arrange the panels like this" request: set from a URL spec's `layout`, carried in a loaded session snapshot (the `encoded-` session param), or written by "move view to a tab/split" from the classic stack. useDockviewController applies it whenever it appears — at mount and after, since a spec sets it on a session whose workspace may already be up — then clears it to undefined (stripped from snapshots) so it never re-applies. |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-getviewidsforpanel">**getViewIdsForPanel**</span><br><code>(panelId: string) =&gt; string[]</code> | Get view IDs for a specific panel, as a plain snapshot array. Never the live MST node: callers iterate this while removing views (which splices the underlying array via the reconcile autorun), so leaking the live array would skip elements mid-iteration. Mutators go through getPanelContainingView instead. |
| <span id="getter-getpanelcontainingview">**getPanelContainingView**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(viewId: string) =&gt; { panelId: string; viewIds: IMSTArray&lt;ISimp…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(viewId: string) =&gt; { panelId: string; viewIds: IMSTArray&lt;ISimpleType&lt;string&gt;&gt; &amp; IStateTreeNode&lt;IArrayType&lt;ISimpleType&lt;string&gt;&gt;&gt;; idx: number; } &#124; undefined</code></pre></dialog></span> | Find the panel containing a view, returning the panel ID, that panel's view-ID list, and the view's index within it (or undefined if unassigned) |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setdockviewlayout">**setDockviewLayout**</span><br><code>(layout: SerializedDockview &#124; undefined) =&gt; void</code> | Save the current dockview layout |
| <span id="action-setactivepanelid">**setActivePanelId**</span><br><code>(panelId: string &#124; undefined) =&gt; void</code> | Set the active panel ID |
| <span id="action-setinit">**setInit**</span><br><code>(init: DockviewLayoutNode &#124; undefined) =&gt; void</code> | Request a panel arrangement; see the `init` property |
| <span id="action-assignviewtopanel">**assignViewToPanel**</span><br><code>(panelId: string, viewId: string) =&gt; void</code> | Put a view in a panel. Appends, but the position within the list is not the render order (see the property's own note), so there is nothing to choose here. |
| <span id="action-removeviewfrompanel">**removeViewFromPanel**</span><br><code>(viewId: string) =&gt; void</code> | Remove a view from its panel |
| <span id="action-removepanel">**removePanel**</span><br><code>(panelId: string) =&gt; void</code> | Remove a panel and all its view assignments |
