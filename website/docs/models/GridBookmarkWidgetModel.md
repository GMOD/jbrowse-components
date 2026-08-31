---
id: gridbookmarkwidgetmodel
title: GridBookmarkWidgetModel
sidebar_label: Widget -> GridBookmarkWidgetModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the `grid-bookmark` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/grid-bookmark/src/GridBookmarkWidget/model.ts).

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-label">**label**</span><br><code>label: types.optional(types.string, '')</code> |  |
| <span id="property-highlight">**highlight**</span><br><code>highlight: types.optional(types.string, DEFAULT_HIGHLIGHT)</code> |  |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  |
| <span id="property-type">**type**</span><br><code>type: types.literal('GridBookmarkWidget')</code> |  |
| <span id="property-bookmarks">**bookmarks**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>bookmarks: types.optional(types.array(LabeledRegionModel), () =…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>bookmarks: types.optional(types.array(LabeledRegionModel), () =&gt;&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;localStorageGetJSON(localStorageKeyF(), []),&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | loaded from localStorage when not present in snapshot; sharedBookmarks from a shared URL are merged in via preProcessSnapshot |

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-selectedbookmarks">**selectedBookmarks**</span><br><code>selectedBookmarks: [] as IExtendedLabeledRegionModel[]</code> |  |
| <span id="volatile-gridview">**gridView**</span><br><code>gridView: 'bookmarks'</code> | which grid tab is visible: bookmarks or highlights |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-assembliesinviews">**assembliesInViews**</span><br><code>Set&lt;string&gt;</code> | assemblies currently displayed in any open view; the grids only show bookmarks/highlights belonging to these |
| <span id="getter-visiblebookmarks">**visibleBookmarks**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(ModelInstanceTypeProps&lt;_OverrideProps&lt;_OverrideProps&lt;…&gt;, { ...…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(ModelInstanceTypeProps&lt;_OverrideProps&lt;_OverrideProps&lt;…&gt;, { ...; }&gt;&gt; &amp; { ...; } &amp; { ...; } &amp; IStateTreeNode&lt;...&gt;)[]</code></pre></dialog></span> | bookmarks belonging to an assembly currently open in a view |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setlabel">**setLabel**</span><br><code>(label: string) =&gt; void</code> |  |
| <span id="action-sethighlight">**setHighlight**</span><br><code>(color: string) =&gt; void</code> |  |
| <span id="action-setgridview">**setGridView**</span><br><code>(arg: "bookmarks" &#124; "both" &#124; "highlights") =&gt; void</code> |  |
| <span id="action-importbookmarks">**importBookmarks**</span><br><code>(regions: Region[]) =&gt; void</code> |  |
| <span id="action-addbookmark">**addBookmark**</span><br><code>(region: Region) =&gt; void</code> |  |
| <span id="action-updatebookmarklabel">**updateBookmarkLabel**</span><br><code>(bookmark: IExtendedLabeledRegionModel, label: string) =&gt; void</code> |  |
| <span id="action-updatebookmarkhighlight">**updateBookmarkHighlight**</span><br><code>(bookmark: IExtendedLabeledRegionModel, color: string) =&gt; void</code> |  |
| <span id="action-updatebulkbookmarkhighlights">**updateBulkBookmarkHighlights**</span><br><code>(color: string) =&gt; void</code> |  |
| <span id="action-setselectedbookmarks">**setSelectedBookmarks**</span><br><code>(bookmarks: IExtendedLabeledRegionModel[]) =&gt; void</code> |  |
| <span id="action-setbookmarkedregions">**setBookmarkedRegions**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(regions: ModelCreationType&lt;ExtractCFromProps&lt;_OverrideProps&lt;_O…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(regions: ModelCreationType&lt;ExtractCFromProps&lt;_OverrideProps&lt;_OverrideProps&lt;…&gt;, { ...; }&gt;&gt;&gt;[]) =&gt; void</code></pre></dialog></span> |  |
| <span id="action-clearselectedbookmarks">**clearSelectedBookmarks**</span><br><code>() =&gt; void</code> |  |
| <span id="action-removebookmarkobject">**removeBookmarkObject**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(arg: ModelInstanceTypeProps&lt;_OverrideProps&lt;_OverrideProps&lt;…&gt;,…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(arg: ModelInstanceTypeProps&lt;_OverrideProps&lt;_OverrideProps&lt;…&gt;, { ...; }&gt;&gt; &amp; { ...; } &amp; { ...; } &amp; IStateTreeNode&lt;...&gt;) =&gt; void</code></pre></dialog></span> |  |
