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

Four levels, matching what the workspace actually has and what a generic window
manager cannot quite express:

branch (a split) > panel (a grid cell) > tab > views (stacked)

dockview models the first three as branch/group/panel and stops there; the
vertical stack of views inside a tab is ours, which is why
`panelViewAssignments` had to exist alongside dockview's own serialized grid.
Here it is one tree, and a tab simply _contains_ its views.

Every action is `tree -> tree` through the pure functions in `tree.ts`, so undo
is `applySnapshot` on this node and nothing else has to be told.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-id">**id**</span><br><code>id: types.identifier</code> |  |
| <span id="property-viewids">**viewIds**</span><br><code>viewIds: types.array(types.string)</code> |  |
| <span id="property-title">**title**</span><br><code>title: types.maybe(types.string)</code> | set only by an explicit rename; otherwise the name is derived from views |
| **id**<br><code>id: types.identifier</code> |  |
| <span id="property-size">**size**</span><br><code>size: types.optional(types.number, 1)</code> |  |
| <span id="property-tabs">**tabs**</span><br><code>tabs: types.array(LayoutTab)</code> |  |
| <span id="property-activetabid">**activeTabId**</span><br><code>activeTabId: types.maybe(types.string)</code> |  |
| **id**<br><code>id: types.identifier</code> |  |
| **size**<br><code>size: types.optional(types.number, 1)</code> |  |
| <span id="property-direction">**direction**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>direction: types.enumeration('LayoutDirection', ['row', 'column…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>direction: types.enumeration('LayoutDirection', ['row', 'column'])</code></pre></dialog></span> |  |
| <span id="property-children">**children**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>children: types.array( types.late((): typeof LayoutPanel =&gt; Lay…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>children: types.array(&#10;&#160;&#160;&#160;&#160;types.late((): typeof LayoutPanel =&gt; LayoutNode as never),&#10;&#160;&#160;)</code></pre></dialog></span> |  |
| <span id="property-layout">**layout**</span><br><code>layout: types.optional(LayoutNode, emptyPanel)</code> |  |
| <span id="property-activepanelid">**activePanelId**</span><br><code>activePanelId: types.maybe(types.string)</code> |  |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-tree">**tree**</span><br><code>LayoutTree</code> | The plain tree the pure functions take.<br><br>`getSnapshot` is a `keepAlive` computed, so this is cached and referentially stable — which also lets MST's reconcile short-circuit on identity when `apply` writes an untouched subtree back.<br><br>Uncast on purpose: the models below and the interfaces in `tree.ts` are two spellings of one shape, and this assignment is the only thing that checks they agree. |
| <span id="getter-panels">**panels**</span><br><code>PanelNode[]</code> |  |
| <span id="getter-tabs">**tabs**</span><br><code>TabNode[]</code> |  |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-haspanel">**hasPanel**</span><br><code>(panelId: string) =&gt; boolean</code> |  |
| <span id="method-findtab">**findTab**</span><br><code>(tabId: string) =&gt; TabHome &#124; undefined</code> |  |
| <span id="method-tabcontainingview">**tabContainingView**</span><br><code>(viewId: string) =&gt; TabHome &#124; undefined</code> |  |
| <span id="method-panelcontainingview">**panelContainingView**</span><br><code>(viewId: string) =&gt; PanelNode &#124; undefined</code> |  |
| <span id="method-viewidsfortab">**viewIdsForTab**</span><br><code>(tabId: string, order: string[]) =&gt; string[]</code> | The views a tab renders: its members, in `session.views` order. |
| <span id="method-activetabof">**activeTabOf**</span><br><code>(panelId: string) =&gt; TabNode &#124; undefined</code> | The tab a panel is showing, or its first. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setactivepanelid">**setActivePanelId**</span><br><code>(panelId: string &#124; undefined) =&gt; void</code> |  |
| <span id="action-setactivetab">**setActiveTab**</span><br><code>(panelId: string, tabId: string) =&gt; void</code> |  |
| <span id="action-renametab">**renameTab**</span><br><code>(tabId: string, title: string &#124; undefined) =&gt; void</code> |  |
| <span id="action-splitpanel">**splitPanel**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(panelId: string, direction: "column" &#124; "row", before?: any) =&gt;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(panelId: string, direction: "column" &#124; "row", before?: any) =&gt; PanelNode &#124; undefined</code></pre></dialog></span> | Split a grid cell; the new cell gets one empty tab. |
| <span id="action-closepanel">**closePanel**</span><br><code>(panelId: string) =&gt; void</code> |  |
| <span id="action-addtab">**addTab**</span><br><code>(panelId: string, viewIds?: string[]) =&gt; TabNode &#124; undefined</code> | "New empty tab": a tab in an existing cell, showing the launcher. |
| <span id="action-closetab">**closeTab**</span><br><code>(tabId: string) =&gt; void</code> | Close a tab, and the cell with it if that was its last.<br><br>A cell whose tabs are all gone is the state `pruneEmptyPanel` was written for — "dragging the last tab out of a split and leaving a blank half is the one place an empty panel is clearly not what was meant" — and closing that tab arrives at the identical half by a different gesture. It rendered nothing at all, not even the launcher an empty TAB shows, so the only way back out of it was the `+`.<br><br>`pruneEmptyPanel` carries both guards already: a cell with tabs left stays, and the last cell in the workspace stays whatever happens to it, since there is nowhere for the tree to collapse to. |
| <span id="action-addviewtotab">**addViewToTab**</span><br><code>(tabId: string, viewId: string) =&gt; void</code> |  |
| <span id="action-droptabinpanel">**dropTabInPanel**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(tabId: string, targetPanelId: string, index?: number &#124; undefin…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(tabId: string, targetPanelId: string, index?: number &#124; undefined) =&gt; void</code></pre></dialog></span> | Drop a dragged tab into an existing panel, as a tab.<br><br>One action, so the tree never exists in a state where the tab is in both panels or neither. The imperative bridge needed an explicit `runInAction` around the unassign+reassign pair for exactly this, and a comment explaining that without it the reconcile autorun would observe the gap and re-home the view. |
| <span id="action-droptabinnewsplit">**dropTabInNewSplit**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(tabId: string, targetPanelId: string, direction: "column" &#124; "r…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(tabId: string, targetPanelId: string, direction: "column" &#124; "row", before: boolean) =&gt; string &#124; undefined</code></pre></dialog></span> | Drop a dragged tab on a panel edge: split, and land in the new half. |
| <span id="action-setsizes">**setSizes**</span><br><code>(branchId: string, sizes: number[]) =&gt; void</code> |  |
| <span id="action-applylayoutspec">**applyLayoutSpec**</span><br><code>(spec: LayoutSpecNode) =&gt; string[]</code> | Arrange the workspace as a spec states.<br><br>There is no `init` property and no standing request: the spec is converted and *becomes* the layout, here and now. `init` existed only because dockview had to be told, could not be told before it mounted, and had to be told again afterwards — three problems that all came from the layout living somewhere this action could not reach. |
| <span id="action-moveviewtonewtab">**moveViewToNewTab**</span><br><code>(viewId: string, allViewIds: string[]) =&gt; string &#124; undefined</code> | ViewMenu's "move to new tab": the view leaves its tab for a new one.<br><br>`allViewIds` is EVERY view in the session, and is required for that reason — homing drops any view the list does not name, so the `[viewId]` default this used to carry unhomed all the others. |
| <span id="action-moveviewtosplitright">**moveViewToSplitRight**</span><br><code>(viewId: string, allViewIds: string[]) =&gt; string &#124; undefined</code> | ViewMenu's "move to split view": the view leaves for a new cell. `allViewIds` is every view in the session — see `moveViewToNewTab`. |
| <span id="action-homeunassignedviews">**homeUnassignedViews**</span><br><code>(viewIds: string[]) =&gt; void</code> |  |
| <span id="action-setpendingmove">**setPendingMove**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(move: PendingMove &#124; undefined, allViewIds?: string[] &#124; undefin…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(move: PendingMove &#124; undefined, allViewIds?: string[] &#124; undefined) =&gt; void</code></pre></dialog></span> | Move one view relative to the others. PUBLIC API: an external plugin calls this behind a `'setPendingMove' in session` guard (jbrowse-plugin-protein3d, putting a protein view beside its genome view). It survived the last storage change by being kept as sugar, and it survives this one the same way — a capability-detecting caller cannot tell you it lost a capability.<br><br>**`allViewIds` is therefore OPTIONAL, and has to stay that way.** The plugin passes the move alone, because that was the whole signature when its call site was written; requiring the second argument threw `undefined.filter` out of a launch the plugin does not wrap, and the figure was again the only thing that noticed. Keeping the NAME is half of not breaking a runtime lookup — the call has to keep working as it is spelled. |
| <span id="action-tileviews">**tileViews**</span><br><code>(mode: TileMode, allViewIds: string[]) =&gt; void</code> | The whole-workspace re-arrange: every view one cell, in one of four shapes. Restored from the dockview header's four "Global:" commands, which went with that component and were not reimplemented.<br><br>`allViewIds` is passed in rather than read off the session for the same reason `moveViewToNewTab` takes it: this mixin owns the tree and has no view list of its own. Passing `session.views` order means the arrangement it states is already the order views render in, so unlike a session spec's layout there is nothing for `orderViews` to apply. |
