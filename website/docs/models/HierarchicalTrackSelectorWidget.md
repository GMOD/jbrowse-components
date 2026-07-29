---
id: hierarchicaltrackselectorwidget
title: HierarchicalTrackSelectorWidget
sidebar_label: Widget -> HierarchicalTrackSelectorWidget
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`data-management` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/data-management/src/HierarchicalTrackSelectorWidget/model.ts).

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  |
| <span id="property-type">**type**</span><br><code>type: types.literal('HierarchicalTrackSelectorWidget')</code> |  |
| <span id="property-view">**view**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>view: types.safeReference( pluginManager.pluggableMstType('view…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>view: types.safeReference(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;pluginManager.pluggableMstType('view', 'stateModel'),&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  |

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-favorites">**favorites**</span><br><code>favorites: localStorageGetJSON&lt;string[]&gt;(favoritesK(), [])</code> |  |
| <span id="volatile-recentlyused">**recentlyUsed**</span><br><code>recentlyUsed: [] as string[]</code> |  |
| <span id="volatile-selection">**selection**</span><br><code>selection: [] as AnyConfigurationModel[]</code> |  |
| <span id="volatile-sorttracknames">**sortTrackNames**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>sortTrackNames: localStorageGetJSON&lt;boolean &#124; undefined&gt;( sortT…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>sortTrackNames: localStorageGetJSON&lt;boolean &#124; undefined&gt;(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;sortTrackNamesK,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;undefined,&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  |
| <span id="volatile-sortcategories">**sortCategories**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>sortCategories: localStorageGetJSON&lt;boolean &#124; undefined&gt;( sortC…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>sortCategories: localStorageGetJSON&lt;boolean &#124; undefined&gt;(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;sortCategoriesK,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;undefined,&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  |
| <span id="volatile-collapsed">**collapsed**</span><br><code>collapsed: observable.map&lt;string, boolean&gt;()</code> |  |
| <span id="volatile-foldercategories">**folderCategories**</span><br><code>folderCategories: observable.set&lt;string&gt;()</code> |  |
| <span id="volatile-filtertext">**filterText**</span><br><code>filterText: ''</code> |  |
| <span id="volatile-recentlyusedcounter">**recentlyUsedCounter**</span><br><code>recentlyUsedCounter: 0</code> |  |
| <span id="volatile-favoritescounter">**favoritesCounter**</span><br><code>favoritesCounter: 0</code> |  |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-showntrackids">**shownTrackIds**</span><br><code>Set&lt;string&gt;</code> |  |
| <span id="getter-selectionset">**selectionSet**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>Set&lt;ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>Set&lt;ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, data: Record&lt;string, unknown&gt;): any; setSlot(slotName: string, value: unknown): void; } &amp; IStateTreeNode&lt;...&gt;&gt;</code></pre></dialog></span> |  |
| <span id="getter-favoritesset">**favoritesSet**</span><br><code>Set&lt;string&gt;</code> |  |
| <span id="getter-recentlyusedset">**recentlyUsedSet**</span><br><code>Set&lt;string&gt;</code> |  |
| <span id="getter-assemblynames">**assemblyNames**</span><br><code>string[]</code> |  |
| <span id="getter-activesorttracknames">**activeSortTrackNames**</span><br><code>any</code> |  |
| <span id="getter-activesortcategories">**activeSortCategories**</span><br><code>any</code> |  |
| <span id="getter-configandsessiontrackconfigurations">**configAndSessionTrackConfigurations**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, d…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, data: Record&lt;string, unknown&gt;): any; setSlot(slotName: string, value: unknown): void; } &amp; IStateTreeNode&lt;...&gt;)[]</code></pre></dialog></span> | filter out tracks that don't match the current assembly/display types |
| <span id="getter-alltrackconfigurations">**allTrackConfigurations**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, d…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, data: Record&lt;string, unknown&gt;): any; setSlot(slotName: string, value: unknown): void; } &amp; IStateTreeNode&lt;...&gt;)[]</code></pre></dialog></span> |  |
| <span id="getter-alltrackconfigurationmap">**allTrackConfigurationMap**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>Map&lt;any, ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: s…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>Map&lt;any, ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, data: Record&lt;string, unknown&gt;): any; setSlot(slotName: string, value: unknown): void; } &amp; IStateTreeNode&lt;...&gt;&gt;</code></pre></dialog></span> | unfiltered map of every track (incl. connection tracks for other assemblies/view types); used by the faceted selector |
| <span id="getter-displayabletrackconfigurationmap">**displayableTrackConfigurationMap**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>Map&lt;any, ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: s…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>Map&lt;any, ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, data: Record&lt;string, unknown&gt;): any; setSlot(slotName: string, value: unknown): void; } &amp; IStateTreeNode&lt;...&gt;&gt;</code></pre></dialog></span> | map restricted to tracks the current view can display; connection tracks go through the same filterTracks() pass as the tree so favorites and recently-used don't surface tracks the view can't show |
| <span id="getter-favoritetracks">**favoriteTracks**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, d…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, data: Record&lt;string, unknown&gt;): any; setSlot(slotName: string, value: unknown): void; } &amp; IStateTreeNode&lt;...&gt;)[]</code></pre></dialog></span> | filters out tracks that are not in the favorites group |
| <span id="getter-recentlyusedtracks">**recentlyUsedTracks**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, d…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, data: Record&lt;string, unknown&gt;): any; setSlot(slotName: string, value: unknown): void; } &amp; IStateTreeNode&lt;...&gt;)[]</code></pre></dialog></span> | filters out tracks that are not in the recently used group |
| <span id="getter-alltracks">**allTracks**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ group: string; id: string; tracks: (ModelInstanceTypeProps&lt;…&gt;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ group: string; id: string; tracks: (ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;…&gt;)[]; noCategories: boolean; defaultCollapsed: boolean; loading: boolean; }[]</code></pre></dialog></span> |  |
| <span id="getter-hierarchy">**hierarchy**</span><br><code>{ name: string; id: string; type: "category"; children: {…}[]; }</code> |  |
| <span id="getter-flatteneditems">**flattenedItems**</span><br><code>TreeNode[]</code> |  |
| <span id="getter-flatteneditemoffsets">**flattenedItemOffsets**</span><br><code>{ cumulativeHeight: number; offsets: number[]; }</code> |  |
| <span id="getter-foldercategorystats">**folderCategoryStats**</span><br><code>Map&lt;string, { active: number; total: number; }&gt;</code> |  |
| <span id="getter-hasanysubcategories">**hasAnySubcategories**</span><br><code>boolean</code> |  |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-isselected">**isSelected**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(track: ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: st…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(track: ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, data: Record&lt;…&gt;): any; setSlot(slotName: string, value: unknown): void; } &amp; IStateTreeNode&lt;...&gt;) =&gt; boolean</code></pre></dialog></span> |  |
| <span id="method-isfavorite">**isFavorite**</span><br><code>(trackId: string) =&gt; boolean</code> |  |
| <span id="method-isrecentlyused">**isRecentlyUsed**</span><br><code>(trackId: string) =&gt; boolean</code> |  |
| <span id="method-getrefseqtrackconf">**getRefSeqTrackConf**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(assemblyName: string) =&gt; (ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IS…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(assemblyName: string) =&gt; (ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;…&gt;) &#124; undefined</code></pre></dialog></span> |  |
| <span id="method-itemoffsets">**itemOffsets**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(height: number, scrollTop: number) =&gt; { startIndex: number; en…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(height: number, scrollTop: number) =&gt; { startIndex: number; endIndex: number; }</code></pre></dialog></span> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setsorttracknames">**setSortTrackNames**</span><br><code>(val: boolean) =&gt; void</code> |  |
| <span id="action-setsortcategories">**setSortCategories**</span><br><code>(val: boolean) =&gt; void</code> |  |
| <span id="action-setselection">**setSelection**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(elt: (ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: str…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(elt: (ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, data: Record&lt;…&gt;): any; setSlot(slotName: string, value: unknown): void; } &amp; IStateTreeNode&lt;...&gt;)[]) =&gt; void</code></pre></dialog></span> |  |
| <span id="action-addtoselection">**addToSelection**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(elt: (ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: str…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(elt: (ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, data: Record&lt;…&gt;): any; setSlot(slotName: string, value: unknown): void; } &amp; IStateTreeNode&lt;...&gt;)[]) =&gt; void</code></pre></dialog></span> |  |
| <span id="action-removefromselection">**removeFromSelection**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(elt: (ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: str…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(elt: (ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, data: Record&lt;…&gt;): any; setSlot(slotName: string, value: unknown): void; } &amp; IStateTreeNode&lt;...&gt;)[]) =&gt; void</code></pre></dialog></span> |  |
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
| <span id="action-togglecategory">**toggleCategory**</span><br><code>(pathName: string) =&gt; void</code> |  |
| <span id="action-setcategorycollapsed">**setCategoryCollapsed**</span><br><code>(pathName: string, status: boolean) =&gt; void</code> |  |
| <span id="action-expandallcategories">**expandAllCategories**</span><br><code>() =&gt; void</code> |  |
| <span id="action-setcollapsedcategories">**setCollapsedCategories**</span><br><code>(str: [string, boolean][]) =&gt; void</code> |  |
| <span id="action-togglefoldercategory">**toggleFolderCategory**</span><br><code>(categoryId: string) =&gt; void</code> |  |
| <span id="action-setfoldercategories">**setFolderCategories**</span><br><code>(ids: string[]) =&gt; void</code> |  |
| <span id="action-clearfiltertext">**clearFilterText**</span><br><code>() =&gt; void</code> |  |
| <span id="action-setfiltertext">**setFilterText**</span><br><code>(newText: string) =&gt; void</code> |  |
| <span id="action-collapsesubcategories">**collapseSubCategories**</span><br><code>() =&gt; void</code> |  |
| <span id="action-collapsetoplevelcategories">**collapseTopLevelCategories**</span><br><code>() =&gt; void</code> |  |
