---
id: workspacelayoutmixin
title: WorkspaceLayoutMixin
sidebar_label: Mixin -> WorkspaceLayoutMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/WorkspaceLayout/model.ts).

The whole workspace as one MST tree:

  branch (a split)  >  panel (a grid cell)  >  tab  >  views (stacked)

Every action is `tree -> tree` through the pure functions in `tree.ts`, so
undo is `applySnapshot` on this node.

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
| <span id="property-maximizedpanelid">**maximizedPanelId**</span><br><code>maximizedPanelId: types.maybe(types.string)</code> | Show only this cell, at the size of the whole workspace. Kept here rather than as a flag on `PanelNode` so no `tree.ts` operation has to say what it does to it. |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-tree">**tree**</span><br><code>LayoutTree</code> | Referentially stable, since `getSnapshot` is cached. Uncast on purpose: this assignment is what checks the models above agree with the interfaces in `tree.ts`. |
| <span id="getter-panels">**panels**</span><br><code>PanelNode[]</code> |  |
| <span id="getter-tabs">**tabs**</span><br><code>TabNode[]</code> |  |
| <span id="getter-visibletree">**visibleTree**</span><br><code>LayoutTree</code> | The maximized cell alone, or the whole tree. The cell is resized to 1 because CSS hands out free space by grow factor only up to a total of 1, so a third-of-a-row cell would draw a third of the window. |

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
| <span id="action-togglemaximizedpanel">**toggleMaximizedPanel**</span><br><code>(panelId: string) =&gt; void</code> | Show one cell at the size of the workspace, or go back; naming a different cell moves the mode. Unmounts every other cell's views rather than hiding them, to stay under the WebGL2 context ceiling (`agent-docs/reference/GPU_PORTABILITY.md`). |
| <span id="action-restorepanels">**restorePanels**</span><br><code>() =&gt; void</code> |  |
| <span id="action-setactivetab">**setActiveTab**</span><br><code>(panelId: string, tabId: string) =&gt; void</code> |  |
| <span id="action-renametab">**renameTab**</span><br><code>(tabId: string, title: string &#124; undefined) =&gt; void</code> |  |
| <span id="action-splitpanel">**splitPanel**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(panelId: string, direction: "column" &#124; "row", before?: any) =&gt;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(panelId: string, direction: "column" &#124; "row", before?: any) =&gt; PanelNode &#124; undefined</code></pre></dialog></span> | Split a grid cell; the new cell gets one empty tab. |
| <span id="action-closepanel">**closePanel**</span><br><code>(panelId: string) =&gt; void</code> |  |
| <span id="action-addtab">**addTab**</span><br><code>(panelId: string, viewIds?: string[]) =&gt; TabNode &#124; undefined</code> | "New empty tab": a tab in an existing cell, showing the launcher. |
| <span id="action-closetab">**closeTab**</span><br><code>(tabId: string) =&gt; void</code> | Close a tab, and its cell too if that was the last tab and not the workspace's last cell: a tabless cell renders nothing at all. |
| <span id="action-addviewtotab">**addViewToTab**</span><br><code>(tabId: string, viewId: string) =&gt; void</code> |  |
| <span id="action-droptabinpanel">**dropTabInPanel**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(tabId: string, targetPanelId: string, index?: number &#124; undefin…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(tabId: string, targetPanelId: string, index?: number &#124; undefined) =&gt; void</code></pre></dialog></span> | Drop a dragged tab into an existing panel, as a tab. |
| <span id="action-droptabinnewsplit">**dropTabInNewSplit**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(tabId: string, targetPanelId: string, direction: "column" &#124; "r…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(tabId: string, targetPanelId: string, direction: "column" &#124; "row", before: boolean) =&gt; string &#124; undefined</code></pre></dialog></span> | Drop a dragged tab on a panel edge: split, and land in the new half. |
| <span id="action-setsizes">**setSizes**</span><br><code>(branchId: string, sizes: number[]) =&gt; void</code> |  |
| <span id="action-applylayoutspec">**applyLayoutSpec**</span><br><code>(spec: LayoutSpecNode&lt;LayoutViewRef&gt;) =&gt; string[]</code> | Arrange the workspace as a spec states, in the shape a session spec's `layout` takes: a leaf's `views` names views by index into `session.views` or by id. A malformed leaf, an index past the end or an unknown id throws. |
| <span id="action-moveviewtonewtab">**moveViewToNewTab**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(viewId: string, allViewIds?: string[] &#124; undefined) =&gt; string &#124;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(viewId: string, allViewIds?: string[] &#124; undefined) =&gt; string &#124; undefined</code></pre></dialog></span> | ViewMenu's "move to new tab": the view leaves its tab for a new one. `allViewIds` is EVERY view in the session, defaulting to the host's own list, since homing drops any view the list omits. |
| <span id="action-moveviewtosplit">**moveViewToSplit**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(viewId: string, direction: "column" &#124; "row", allViewIds?: stri…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(viewId: string, direction: "column" &#124; "row", allViewIds?: string[] &#124; undefined) =&gt; string &#124; undefined</code></pre></dialog></span> | ViewMenu's "move to split": the view leaves for a new cell to the right (`row`) or below (`column`) of its own. |
| <span id="action-moveviewtotab">**moveViewToTab**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(viewId: string, tabId: string, allViewIds?: string[] &#124; undefin…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(viewId: string, tabId: string, allViewIds?: string[] &#124; undefined) =&gt; void</code></pre></dialog></span> | ViewMenu's "move to tab": the view joins an existing tab, which becomes the one shown. |
| <span id="action-homeunassignedviews">**homeUnassignedViews**</span><br><code>(viewIds: string[]) =&gt; void</code> |  |
| <span id="action-setpendingmove">**setPendingMove**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(move: PendingMove &#124; undefined, allViewIds?: string[] &#124; undefin…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(move: PendingMove &#124; undefined, allViewIds?: string[] &#124; undefined) =&gt; void</code></pre></dialog></span> | Move one view to a new tab or a split beside its cell, keeping the rest of the arrangement. PUBLIC API: protein3d and msaview call it with the move alone, so `allViewIds` stays optional; it is read only on a host with no view list. |
| <span id="action-tileviews">**tileViews**</span><br><code>(mode: TileMode, allViewIds: string[]) =&gt; void</code> | Re-arrange the whole workspace, one view per cell, in one of four shapes. Pass `allViewIds` in `session.views` order so there is nothing for `orderViews` to apply. |
| <span id="action-layoutviews">**layoutViews**</span><br><code>(spec: LayoutSpecNode&lt;LayoutViewRef&gt;) =&gt; string[]</code> | Arrange the session's views into panels. Calls `applyLayoutSpec`, turns workspaces mode on for this session (a layout renders nowhere else), and orders `session.views` to the spec's top-to-bottom order, which tabs read their order from. Without the last two steps the layout applies but does not display, or the tabs appear in the wrong order. Leaves take view ids or indexes into `session.views`; a layout that seats no view throws rather than leaving a blank tab. A session spec's `layout` and an agent's live re-layout both call it. |
