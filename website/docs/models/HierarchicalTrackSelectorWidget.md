---
id: hierarchicaltrackselectorwidget
title: HierarchicalTrackSelectorWidget
sidebar_label: Widget -> HierarchicalTrackSelectorWidget
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the `data-management` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/data-management/src/HierarchicalTrackSelectorWidget/model.ts).

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  |
| <span id="property-type">**type**</span><br><code>type: types.literal('HierarchicalTrackSelectorWidget')</code> |  |
| <span id="property-view">**view**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>view: types.safeReference( pluginManager.pluggableMstType('view…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>view: types.safeReference(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;pluginManager.pluggableMstType('view', 'stateModel'),&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  |
| <span id="property-trackcontainerid">**trackContainerId**</span><br><code>trackContainerId: types.maybe(types.string)</code> | Which of the view's track containers this selector writes into, by id. Absent — the usual case — means the view itself. A view owning several track lists (the synteny view, one per level band) names one here; the container is resolved through `view.trackContainerFor` rather than referenced directly, because it isn't a view and so isn't a legal target for the `view` reference above. |

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-favorites">**favorites**</span><br><code>favorites: localStorageGetJSON&lt;string[]&gt;(favoritesK(), [])</code> |  |
| <span id="volatile-recentlyused">**recentlyUsed**</span><br><code>recentlyUsed: [] as string[]</code> |  |
| <span id="volatile-selectedtrackids">**selectedTrackIds**</span><br><code>selectedTrackIds: [] as string[]</code> | the shopping cart, by trackId — like favorites, recentlyUsed and shownTrackIds, and unlike the config objects it used to hold. A config is not a stable identity: a non-admin's edit to an admin track resolves through a fresh merged object (ADR-032), so a selection holding the old one kept counting in the cart while the row it belonged to went back to looking unselected. Read `selection` for the configs. |
| <span id="volatile-sorttracknames">**sortTrackNames**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>sortTrackNames: localStorageGetJSON&lt;boolean &#124; undefined&gt;( sortT…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>sortTrackNames: localStorageGetJSON&lt;boolean &#124; undefined&gt;(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;sortTrackNamesK,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;undefined,&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  |
| <span id="volatile-sortcategories">**sortCategories**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>sortCategories: localStorageGetJSON&lt;boolean &#124; undefined&gt;( sortC…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>sortCategories: localStorageGetJSON&lt;boolean &#124; undefined&gt;(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;sortCategoriesK,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;undefined,&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  |
| <span id="volatile-categorymode">**categoryMode**</span><br><code>categoryMode: observable.map&lt;string, CategoryMode&gt;()</code> | per-category rendering mode; absent means expanded. Collapsed and folder are mutually exclusive by construction, so un-foldering a category can't reveal a stale collapse underneath it |
| <span id="volatile-filtertext">**filterText**</span><br><code>filterText: ''</code> |  |
| <span id="volatile-recentlyusedcounter">**recentlyUsedCounter**</span><br><code>recentlyUsedCounter: 0</code> |  |
| <span id="volatile-favoritescounter">**favoritesCounter**</span><br><code>favoritesCounter: 0</code> |  |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-trackcontainer">**trackContainer**</span><br><code>TrackContainer &#124; undefined</code> | The track list this selector shows and writes into: the view itself, or one of its containers when `trackContainerId` names one. |
| <span id="getter-showntrackids">**shownTrackIds**</span><br><code>Set&lt;string&gt;</code> |  |
| <span id="getter-favoritesset">**favoritesSet**</span><br><code>Set&lt;string&gt;</code> |  |
| <span id="getter-recentlyusedset">**recentlyUsedSet**</span><br><code>Set&lt;string&gt;</code> |  |
| <span id="getter-assemblynames">**assemblyNames**</span><br><code>string[]</code> |  |
| <span id="getter-activesorttracknames">**activeSortTrackNames**</span><br><code>any</code> |  |
| <span id="getter-activesortcategories">**activeSortCategories**</span><br><code>any</code> |  |
| <span id="getter-configandsessiontrackconfigurations">**configAndSessionTrackConfigurations**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, d…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, data: Record&lt;string, unknown&gt;): any; setSlot(slotName: string, value: unknown): void; } &amp; IStateTreeNode&lt;...&gt;)[]</code></pre></dialog></span> | filter out tracks that don't match the current assembly/display types |
| <span id="getter-alltracks">**allTracks**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ group: string; id: string; tracks: TrackNodeSource[]; default…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ group: string; id: string; tracks: TrackNodeSource[]; defaultCollapsed: boolean; loading: boolean; }[]</code></pre></dialog></span> | one group per connection *config* (not just live instances), so a connection shows in the tree before it's loaded; expanding it hydrates the connection (see toggleCategory). Tracks are empty until then.<br><br>Each track is resolved to a TrackNodeSource and sorted here rather than in generateHierarchy, so a filterText keystroke reads no configs and re-sorts nothing (filtering preserves order) |
| <span id="getter-filterquery">**filterQuery**</span><br><code>string</code> | the normalized filter box contents; empty when nothing is being searched for |
| <span id="getter-filteractive">**filterActive**</span><br><code>boolean</code> | a query is being searched for, which forces categories open (isFilterForcedOpen) |
| <span id="getter-filteredtrackset">**filteredTrackSet**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>Set&lt;ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>Set&lt;ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, data: Record&lt;string, unknown&gt;): any; setSlot(slotName: string, value: unknown): void; } &amp; IStateTreeNode&lt;...&gt;&gt;</code></pre></dialog></span> | tracks matching filterText. An empty query matches everything, since ''.includes is always true, so there is no unfiltered special case |
| <span id="getter-sessiontrackids">**sessionTrackIds**</span><br><code>Set&lt;any&gt;</code> | a non-admin's added/copied tracks, which the tree groups under a "Session tracks" category. Membership is the session's own list — the source of truth — not a suffix baked into the trackId |
| <span id="getter-alltrackconfigurations">**allTrackConfigurations**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, d…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, data: Record&lt;string, unknown&gt;): any; setSlot(slotName: string, value: unknown): void; } &amp; IStateTreeNode&lt;...&gt;)[]</code></pre></dialog></span> | every track the current view can display, tree order. Derived from allTracks so there is exactly one filterTracks() pass, shared with the tree: the faceted selector, favorites and recently-used then can't offer a track the view has no way to open. Connection tracks used to reach the faceted selector unfiltered, which listed a connection's other-assembly tracks next to the config's filtered ones |
| <span id="getter-alltrackconfigurationmap">**allTrackConfigurationMap**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>Map&lt;any, ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: s…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>Map&lt;any, ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, data: Record&lt;string, unknown&gt;): any; setSlot(slotName: string, value: unknown): void; } &amp; IStateTreeNode&lt;...&gt;&gt;</code></pre></dialog></span> |  |
| <span id="getter-selection">**selection**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, d…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, data: Record&lt;string, unknown&gt;): any; setSlot(slotName: string, value: unknown): void; } &amp; IStateTreeNode&lt;...&gt;)[]</code></pre></dialog></span> | The selected track configs, resolved from `selectedTrackIds` on read exactly as favorites and recently-used are. That is the one gate for every delete path (the cart's own "Delete tracks", a single track's menu) — a track that has gone away no longer resolves, so nothing has to clean up after it — and it is what keeps an edited track selected, since the id outlives the config object an edit replaces. |
| <span id="getter-selectionset">**selectionSet**</span><br><code>Set&lt;string&gt;</code> | the selected trackIds that still resolve to a track — `selection`'s ids, so a row can ask whether it is selected without the config identity comparison that used to answer it |
| <span id="getter-favoritetracks">**favoriteTracks**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, d…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, data: Record&lt;string, unknown&gt;): any; setSlot(slotName: string, value: unknown): void; } &amp; IStateTreeNode&lt;...&gt;)[]</code></pre></dialog></span> | filters out tracks that are not in the favorites group |
| <span id="getter-recentlyusedtracks">**recentlyUsedTracks**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, d…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, data: Record&lt;string, unknown&gt;): any; setSlot(slotName: string, value: unknown): void; } &amp; IStateTreeNode&lt;...&gt;)[]</code></pre></dialog></span> | filters out tracks that are not in the recently used group |
| <span id="getter-hierarchy">**hierarchy**</span><br><code>{ name: string; id: string; type: "category"; children: {…}[]; }</code> | a group is kept even when no track in it survives the filter, so an empty connection still shows in the tree |
| <span id="getter-rows">**rows**</span><br><code>TreeRow[]</code> | every rendered row, in order, with its height and scroll offset |
| <span id="getter-treeheight">**treeHeight**</span><br><code>number</code> |  |
| <span id="getter-foldertracknodes">**folderTrackNodes**</span><br><code>Map&lt;string, TreeTrackNode[]&gt;</code> |  |
| <span id="getter-foldercategorystats">**folderCategoryStats**</span><br><code>Map&lt;string, { active: number; total: number; }&gt;</code> |  |
| <span id="getter-hasanysubcategories">**hasAnySubcategories**</span><br><code>boolean</code> |  |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-isfavorite">**isFavorite**</span><br><code>(trackId: string) =&gt; boolean</code> |  |
| <span id="method-isrecentlyused">**isRecentlyUsed**</span><br><code>(trackId: string) =&gt; boolean</code> |  |
| <span id="method-getrefseqtrackconf">**getRefSeqTrackConf**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(assemblyName: string) =&gt; (ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IS…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(assemblyName: string) =&gt; (ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;…&gt;) &#124; undefined</code></pre></dialog></span> |  |
| <span id="method-isselected">**isSelected**</span><br><code>(trackId: string) =&gt; boolean</code> |  |
| <span id="method-visiblerange">**visibleRange**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(height: number, scrollTop: number) =&gt; { startIndex: number; en…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(height: number, scrollTop: number) =&gt; { startIndex: number; endIndex: number; }</code></pre></dialog></span> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setsorttracknames">**setSortTrackNames**</span><br><code>(val: boolean) =&gt; void</code> |  |
| <span id="action-setsortcategories">**setSortCategories**</span><br><code>(val: boolean) =&gt; void</code> |  |
| <span id="action-setselection">**setSelection**</span><br><code>(trackIds: string[]) =&gt; void</code> |  |
| <span id="action-addtoselection">**addToSelection**</span><br><code>(trackIds: string[]) =&gt; void</code> |  |
| <span id="action-removefromselection">**removeFromSelection**</span><br><code>(trackIds: string[]) =&gt; void</code> |  |
| <span id="action-clearselection">**clearSelection**</span><br><code>() =&gt; void</code> |  |
| <span id="action-addtofavorites">**addToFavorites**</span><br><code>(trackId: string) =&gt; void</code> |  |
| <span id="action-removefromfavorites">**removeFromFavorites**</span><br><code>(trackId: string) =&gt; void</code> |  |
| <span id="action-clearfavorites">**clearFavorites**</span><br><code>() =&gt; void</code> |  |
| <span id="action-setrecentlyusedcounter">**setRecentlyUsedCounter**</span><br><code>(val: number) =&gt; void</code> |  |
| <span id="action-setrecentlyused">**setRecentlyUsed**</span><br><code>(str: string[]) =&gt; void</code> |  |
| <span id="action-setfavoritescounter">**setFavoritesCounter**</span><br><code>(val: number) =&gt; void</code> |  |
| <span id="action-addtorecentlyused">**addToRecentlyUsed**</span><br><code>(id: string) =&gt; void</code> |  |
| <span id="action-clearrecentlyused">**clearRecentlyUsed**</span><br><code>() =&gt; void</code> |  |
| <span id="action-setview">**setView**</span><br><code>(view: unknown) =&gt; void</code> |  |
| <span id="action-settrackcontainerid">**setTrackContainerId**</span><br><code>(id: string &#124; undefined) =&gt; void</code> |  |
| <span id="action-setcategorymode">**setCategoryMode**</span><br><code>(id: string, mode: CategoryMode &#124; undefined) =&gt; void</code> |  |
| <span id="action-clearcategorymodes">**clearCategoryModes**</span><br><code>() =&gt; void</code> |  |
| <span id="action-clearfiltertext">**clearFilterText**</span><br><code>() =&gt; void</code> |  |
| <span id="action-setfiltertext">**setFilterText**</span><br><code>(newText: string) =&gt; void</code> |  |
| <span id="action-setcategorycollapsed">**setCategoryCollapsed**</span><br><code>(id: string, collapsed: boolean) =&gt; void</code> | the single gate on accordion state: a folder is a mode the user picked, not an accordion that happens to be shut, so every collapse/expand — one row, a bulk menu item, or "expand all" — passes it by |
| <span id="action-setfoldercategory">**setFolderCategory**</span><br><code>(id: string, isFolder: boolean) =&gt; void</code> | folder and collapsed are the same slot, so leaving folder mode always lands on an expanded category |
| <span id="action-expandallcategories">**expandAllCategories**</span><br><code>() =&gt; void</code> |  |
| <span id="action-togglecategory">**toggleCategory**</span><br><code>(id: string) =&gt; void</code> |  |
| <span id="action-collapsesubcategories">**collapseSubCategories**</span><br><code>() =&gt; void</code> |  |
| <span id="action-collapsetoplevelcategories">**collapseTopLevelCategories**</span><br><code>() =&gt; void</code> |  |
