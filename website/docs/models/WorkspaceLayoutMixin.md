---
id: workspacelayoutmixin
title: WorkspaceLayoutMixin
sidebar_label: Mixin -> WorkspaceLayoutMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/WorkspaceLayout/model.ts).

The whole workspace, in one MST tree. There is no second owner, so there is
nothing to reconcile, no event to echo, and no window during which the two
disagree — which is the entire content of `useDockviewController`.

Compare what this replaces: `dockviewLayout` (an opaque blob dockview owned and
we mirrored), `panelViewAssignments` (panel -> views, ours), and
`activePanelId`. The first two said overlapping things in two vocabularies. Here
a panel simply _contains_ its views.

Every action is `tree -> tree` through the pure functions in `tree.ts`, so undo
is `applySnapshot` on this node and nothing else has to be told.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-id">**id**</span><br><code>id: types.identifier</code> |  |
| <span id="property-size">**size**</span><br><code>size: types.optional(types.number, 1)</code> |  |
| <span id="property-viewids">**viewIds**</span><br><code>viewIds: types.array(types.string)</code> |  |
| <span id="property-id">**id**</span><br><code>id: types.identifier</code> |  |
| <span id="property-size">**size**</span><br><code>size: types.optional(types.number, 1)</code> |  |
| <span id="property-direction">**direction**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>direction: types.enumeration('LayoutDirection', ['row', 'column…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>direction: types.enumeration('LayoutDirection', ['row', 'column'])</code></pre></dialog></span> |  |
| <span id="property-children">**children**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>children: types.array( types.late((): typeof LayoutPanel =&gt; Lay…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>children: types.array(&#10;&#160;&#160;&#160;&#160;types.late((): typeof LayoutPanel =&gt; LayoutNode as never),&#10;&#160;&#160;)</code></pre></dialog></span> |  |
| <span id="property-layout">**layout**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>layout: types.optional(LayoutNode, () =&gt; ({ id: nextPanelId(),…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>layout: types.optional(LayoutNode, () =&gt; ({&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;id: nextPanelId(),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;size: 1,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;viewIds: [],&#10;&#160;&#160;&#160;&#160;&#160;&#160;}))</code></pre></dialog></span> |  |
| <span id="property-activepanelid">**activePanelId**</span><br><code>activePanelId: types.maybe(types.string)</code> |  |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-tree">**tree**</span><br><code>LayoutTree</code> |  |
| <span id="getter-panels">**panels**</span><br><code>PanelNode[]</code> |  |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-panelcontainingview">**panelContainingView**</span><br><code>(viewId: string) =&gt; PanelNode &#124; undefined</code> |  |
| <span id="method-viewidsforpanel">**viewIdsForPanel**</span><br><code>(panelId: string, order: string[]) =&gt; string[]</code> | The views a panel renders, in `session.views` order. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-splitpanel">**splitPanel**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(panelId: string, direction: "row" &#124; "column", before?: any) =&gt;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(panelId: string, direction: "row" &#124; "column", before?: any) =&gt; string</code></pre></dialog></span> |  |
| <span id="action-closepanel">**closePanel**</span><br><code>(panelId: string) =&gt; void</code> |  |
| <span id="action-addviewtopanel">**addViewToPanel**</span><br><code>(panelId: string, viewId: string) =&gt; void</code> |  |
| <span id="action-removeview">**removeView**</span><br><code>(viewId: string) =&gt; void</code> |  |
| <span id="action-moveviewtopanel">**moveViewToPanel**</span><br><code>(viewId: string, panelId: string) =&gt; void</code> |  |
| <span id="action-setsizes">**setSizes**</span><br><code>(branchId: string, sizes: number[]) =&gt; void</code> |  |
| <span id="action-dropviewinpanel">**dropViewInPanel**</span><br><code>(viewId: string, targetPanelId: string) =&gt; void</code> | Drop a dragged view into an existing panel, as a tab.<br><br>One action, so the tree never exists in a state where the view is in both panels or neither. The imperative bridge needed an explicit `runInAction` around the unassign+reassign pair for exactly this, and a comment explaining that without it the reconcile autorun would observe the gap and re-home the view. |
| <span id="action-dropviewinnewsplit">**dropViewInNewSplit**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(viewId: string, targetPanelId: string, direction: "row" &#124; "col…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(viewId: string, targetPanelId: string, direction: "row" &#124; "column", before: boolean) =&gt; string</code></pre></dialog></span> | Drop a dragged view onto a panel edge: split, and land in the new half. |
| <span id="action-setactivepanelid">**setActivePanelId**</span><br><code>(panelId: string &#124; undefined) =&gt; void</code> |  |
| <span id="action-homeunassignedviews">**homeUnassignedViews**</span><br><code>(viewIds: string[]) =&gt; void</code> | Put any view that no panel holds into the active panel. The only reconciliation left, and it is one-directional: views are owned elsewhere (`session.views`), so a newly launched one has to land somewhere. Nothing reads back. |
