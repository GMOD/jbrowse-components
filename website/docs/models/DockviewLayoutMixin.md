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
| <span id="property-dockviewlayout">**dockviewLayout**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>dockviewLayout: types.stripDefault( types.maybe(types.frozen&lt;Se…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>dockviewLayout: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.maybe(types.frozen&lt;SerializedDockview&gt;()),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;undefined,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | Serialized dockview layout state |
| <span id="property-panelviewassignments">**panelViewAssignments**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>panelViewAssignments: types.stripDefault( types.map(types.array…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>panelViewAssignments: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.map(types.array(types.string)),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;{},&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | Maps panel IDs to arrays of view IDs (for stacking views within a panel) |
| <span id="property-activepanelid">**activePanelId**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>activePanelId: types.stripDefault(types.maybe(types.string), un…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>activePanelId: types.stripDefault(types.maybe(types.string), undefined)</code></pre></dialog></span> | The currently active panel ID in dockview |
| <span id="property-init">**init**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>init: types.stripDefault( types.maybe(types.frozen&lt;DockviewLayo…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>init: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.maybe(types.frozen&lt;DockviewLayoutNode&gt;()),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;undefined,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | The initial nested layout to build dockview from (simple viewIds/ direction/size form, vs. the verbose `dockviewLayout` dockview emits). Set from URL params (spec layout) OR carried in a loaded session snapshot (e.g. the `encoded-` session param), then consumed once when the dockview container mounts — `createInitialPanels` reads it, `applyInitLayout` builds the panels, and it is cleared to undefined (stripped from snapshots) so it never re-applies on a later remount. |

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-pendingmove">**pendingMove**</span><br><code>pendingMove: undefined</code> |  |

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
| <span id="action-setinit">**setInit**</span><br><code>(init: DockviewLayoutNode &#124; undefined) =&gt; void</code> | Set the initial layout configuration (from URL params) |
| <span id="action-setpendingmove">**setPendingMove**</span><br><code>(pendingMove: PendingMove &#124; undefined) =&gt; void</code> | Queue a view move to be applied when the dockview container mounts |
| <span id="action-assignviewtopanel">**assignViewToPanel**</span><br><code>(panelId: string, viewId: string) =&gt; void</code> | Assign a view to a panel (adds to the panel's view stack) |
| <span id="action-removeviewfrompanel">**removeViewFromPanel**</span><br><code>(viewId: string) =&gt; void</code> | Remove a view from its panel |
| <span id="action-removepanel">**removePanel**</span><br><code>(panelId: string) =&gt; void</code> | Remove a panel and all its view assignments |
| <span id="action-moveviewupinpanel">**moveViewUpInPanel**</span><br><code>(viewId: string) =&gt; void</code> | Move a view up within its panel's view stack |
| <span id="action-moveviewdowninpanel">**moveViewDownInPanel**</span><br><code>(viewId: string) =&gt; void</code> | Move a view down within its panel's view stack |
| <span id="action-moveviewtotopinpanel">**moveViewToTopInPanel**</span><br><code>(viewId: string) =&gt; void</code> | Move a view to the top of its panel's view stack |
| <span id="action-moveviewtobottominpanel">**moveViewToBottomInPanel**</span><br><code>(viewId: string) =&gt; void</code> | Move a view to the bottom of its panel's view stack |
