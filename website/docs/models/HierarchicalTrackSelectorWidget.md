---
id: hierarchicaltrackselectorwidget
title: HierarchicalTrackSelectorWidget
description: "Lists a view's available tracks as a tree of categories, with a filter box, favorites and recently used tracks, and a group for each connection."
sidebar_label: Widget -> HierarchicalTrackSelectorWidget
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source. See the [developer guide](/docs/developer_guide/) for concepts. Provided by the `data-management` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/data-management/src/HierarchicalTrackSelectorWidget/model.ts).

Lists a view's available tracks as a tree of categories, with a filter box,
favorites and recently used tracks, and a group for each connection.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-id">**id**</span><br><code>string</code> · default <code>createElementId()</code> | The identifier references to this node resolve through. A snapshot that leaves it out gets a generated one. |
| <span id="property-type">**type**</span><br><code>"HierarchicalTrackSelectorWidget"</code> | Always `"HierarchicalTrackSelectorWidget"`, the name a snapshot selects this model by. |
| <span id="property-view">**view**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>BaseViewModel &amp; Pick&lt;…&gt; &#124; undefined</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code><a href="../baseviewmodel">BaseViewModel</a> &amp; Pick&lt;AbstractViewModel, "assemblyNames" &#124; "regionHost" &#124; "trackContainerFor" &#124; "trackContainers" &#124; "type"&gt; &#124; undefined</code></pre></dialog></span> |  |
| <span id="property-trackcontainerid">**trackContainerId**</span><br><code>string &#124; undefined</code> | Which of the view's track containers this selector writes into, by id. Absent — the usual case — means the view itself. A view owning several track lists (the synteny view, one per level band) names one here; the container is resolved through `view.trackContainerFor` rather than referenced directly, because it isn't a view and so isn't a legal target for the `view` reference above. |

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-favorites">**favorites**</span><br><code>string[]</code> |  |
| <span id="volatile-recentlyused">**recentlyUsed**</span><br><code>string[]</code> |  |
| <span id="volatile-selectedtrackids">**selectedTrackIds**</span><br><code>string[]</code> | the shopping cart, by trackId; `selection` resolves the configs |
| <span id="volatile-categorymode">**categoryMode**</span><br><code>ObservableMap&lt;string, CategoryMode&gt;</code> | per-category rendering mode; absent means expanded. Collapsed and folder are mutually exclusive by construction, so un-foldering a category can't reveal a stale collapse underneath it |
| <span id="volatile-tableviewid">**tableViewId**</span><br><code>string &#124; undefined</code> | the view whose tracks the drawer shows as a table in place of the tree. Keyed by view because every view's selector is this one widget, so table mode opened for one view stays with it |
| <span id="volatile-tabledrawerwidth">**tableDrawerWidth**</span><br><code>number &#124; undefined</code> | the drawer width the table asks for, read by the session as `preferredDrawerWidth` and never written into its saved width |
| <span id="volatile-tracklist">**trackList**</span><br><code>TrackList</code> | which tracks the tree and the table list: all of them, or only the favorites or the recently used |
| <span id="volatile-tracktable">**trackTable**</span><br><code>TrackTableModel</code> | the filter box, facet filters, sort and columns the tree and the table share |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-filtertext">**filterText**</span><br><code>string</code> | the text in the filter box |
| <span id="getter-trackcontainer">**trackContainer**</span><br><code>TrackContainer &#124; undefined</code> | The track list this selector shows and writes into: the view itself, or one of its containers when `trackContainerId` names one. |
| <span id="getter-showtable">**showTable**</span><br><code>boolean</code> | whether the drawer shows this view's tracks as a table |
| <span id="getter-preferreddrawerwidth">**preferredDrawerWidth**</span><br><code>number &#124; undefined</code> | the drawer width the session draws while the table shows |
| <span id="getter-showntrackids">**shownTrackIds**</span><br><code>Set&lt;string&gt;</code> |  |
| <span id="getter-favoritesset">**favoritesSet**</span><br><code>Set&lt;string&gt;</code> |  |
| <span id="getter-recentlyusedset">**recentlyUsedSet**</span><br><code>Set&lt;string&gt;</code> |  |
| <span id="getter-assemblynames">**assemblyNames**</span><br><code>string[]</code> |  |
| <span id="getter-configandsessiontrackconfigurations">**configAndSessionTrackConfigurations**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>((ConfigNodeProps&lt;…&gt; &amp; ConfigNodeActions &amp; ConfigNodeBrand&lt;…&gt;)…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>((ConfigNodeProps&lt;TrackConfigDefinition&gt; &amp; ConfigNodeActions &amp; ConfigNodeBrand&lt;TrackConfigSchema&gt;) &#124; TrackConfigEntry)[]</code></pre></dialog></span> | the tracks this view can be offered — its assemblies' sequence tracks, then the session's list filtered to what it can draw |
| <span id="getter-sessiontrackids">**sessionTrackIds**</span><br><code>Set&lt;any&gt;</code> | a non-admin's added/copied tracks, which the tree groups under a "Session tracks" category. Membership is the session's own list — the source of truth — not a suffix baked into the trackId |
| <span id="getter-maingrouptracks">**mainGroupTracks**</span><br><code>TrackNodeSource[]</code> | the config's own and the session's tracks, resolved and sorted. Its own getter, so a connection loading re-reads none of them |
| <span id="getter-alltracks">**allTracks**</span><br><code>TrackGroup[]</code> | the main group, then one group per connection config whether or not it is loaded. A dormant connection has no tracks and defaults collapsed; expanding it loads it (see toggleCategory) |
| <span id="getter-alltrackconfigurationmap">**allTrackConfigurationMap**</span><br><code>Map&lt;string, AnyTrackConfig&gt;</code> | every track the view can display by trackId, in tree order; a track in both the config and a connection resolves to the config's copy, as the session's getTrackById does. A connection's tracks are its live entries, before any edit. |
| <span id="getter-alltrackconfigurations">**allTrackConfigurations**</span><br><code>AnyTrackConfig[]</code> | every track the view can display, once each, in tree order: what the table selector, favorites and recently-used resolve against |
| <span id="getter-selection">**selection**</span><br><code>AnyTrackConfig[]</code> | the selected track configs, resolved from `selectedTrackIds` on read, so a deleted track drops out and an edited one stays selected |
| <span id="getter-selectionset">**selectionSet**</span><br><code>Set&lt;string&gt;</code> | the selected trackIds that still resolve to a track |
| <span id="getter-favoritetracks">**favoriteTracks**</span><br><code>(TrackConfigEntry &#124; TrackConfigNode)[]</code> | filters out tracks that are not in the favorites group |
| <span id="getter-recentlyusedtracks">**recentlyUsedTracks**</span><br><code>(TrackConfigEntry &#124; TrackConfigNode)[]</code> | filters out tracks that are not in the recently used group |
| <span id="getter-listedtrackorder">**listedTrackOrder**</span><br><code>string[] &#124; undefined</code> | the favorites in the order they were added, or the recently used newest first; undefined when listing all |
| <span id="getter-listedtrackconfigurations">**listedTrackConfigurations**</span><br><code>AnyTrackConfig[]</code> | the track configs the tree and the table list, in the list's own order |
| <span id="getter-emptylistmessage">**emptyListMessage**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>"No favorite tracks yet. Add one from a track’s menu." &#124; …</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>"No favorite tracks yet. Add one from a track’s menu." &#124; "No recently used tracks yet." &#124; "No tracks" &#124; "None of your favorite tracks can show in this view. Add one from a track’s menu."</code></pre></dialog></span> | what the tree and the table say when the list itself has no tracks; favorites are kept across a config's genomes and views, so some may be ones this view cannot show |
| <span id="getter-textkeptids">**textKeptIds**</span><br><code>Set&lt;string&gt; &#124; undefined</code> | the trackIds whose searchText (name, categories, description and metadata values) holds every term in the filter box; undefined when the box holds no terms |
| <span id="getter-searchterms">**searchTerms**</span><br><code>string[]</code> | the terms a kept row must contain, which matchHint explains |
| <span id="getter-filteractive">**filterActive**</span><br><code>boolean</code> | a query, a facet filter or the favorites or recent list narrows the tree, which forces categories open (isFilterForcedOpen) |
| <span id="getter-hierarchy">**hierarchy**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ name: string; id: string; type: "category"; … }</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ name: string; id: string; type: "category"; children: TreeNode[]; }</code></pre></dialog></span> | a connection's group is kept even when no track in it survives the filter, since clicking it is what loads it; the config's own group goes, so a filter that keeps nothing says so instead of drawing a lone "Tracks" row |
| <span id="getter-flatlist">**flatList**</span><br><code>TreeNode[]</code> | the favorites or recently used tracks as a flat list in the list's own order, newest first for recent, with no category tree or group header: the toggle above already names the list |
| <span id="getter-rows">**rows**</span><br><code>TreeRow[]</code> | every rendered row, in order, with its height and scroll offset |
| <span id="getter-treeheight">**treeHeight**</span><br><code>number</code> |  |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-isfavorite">**isFavorite**</span><br><code>(trackId: string) =&gt; boolean</code> |  |
| <span id="method-isrecentlyused">**isRecentlyUsed**</span><br><code>(trackId: string) =&gt; boolean</code> |  |
| <span id="method-removableconnection">**removableConnection**</span><br><code>(groupId: string) =&gt; <a href="../../config/baseconnection">BaseConnectionConfig</a> &#124; undefined</code> | the connection a top-level group's row may delete: any for an admin, otherwise one the session itself holds, which is every connection where the session and the config are one document |
| <span id="method-isselected">**isSelected**</span><br><code>(trackId: string) =&gt; boolean</code> |  |
| <span id="method-visiblerange">**visibleRange**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(height: number, scrollTop: number) =&gt; { startIndex: number; … }</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(height: number, scrollTop: number) =&gt; { startIndex: number; endIndex: number; }</code></pre></dialog></span> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setselection">**setSelection**</span><br><code>(trackIds: string[]) =&gt; void</code> |  |
| <span id="action-addtoselection">**addToSelection**</span><br><code>(trackIds: string[]) =&gt; void</code> |  |
| <span id="action-removefromselection">**removeFromSelection**</span><br><code>(trackIds: string[]) =&gt; void</code> |  |
| <span id="action-clearselection">**clearSelection**</span><br><code>() =&gt; void</code> |  |
| <span id="action-addtofavorites">**addToFavorites**</span><br><code>(trackId: string) =&gt; void</code> |  |
| <span id="action-removefromfavorites">**removeFromFavorites**</span><br><code>(trackId: string) =&gt; void</code> |  |
| <span id="action-clearfavorites">**clearFavorites**</span><br><code>() =&gt; void</code> |  |
| <span id="action-setrecentlyused">**setRecentlyUsed**</span><br><code>(str: string[]) =&gt; void</code> |  |
| <span id="action-addtorecentlyused">**addToRecentlyUsed**</span><br><code>(id: string) =&gt; void</code> |  |
| <span id="action-clearrecentlyused">**clearRecentlyUsed**</span><br><code>() =&gt; void</code> |  |
| <span id="action-settracklist">**setTrackList**</span><br><code>(trackList: TrackList) =&gt; void</code> |  |
| <span id="action-setview">**setView**</span><br><code>(view: IBaseViewModel &#124; undefined) =&gt; void</code> |  |
| <span id="action-settrackcontainerid">**setTrackContainerId**</span><br><code>(id: string &#124; undefined) =&gt; void</code> |  |
| <span id="action-setcategorymode">**setCategoryMode**</span><br><code>(id: string, mode: CategoryMode &#124; undefined) =&gt; void</code> |  |
| <span id="action-clearcategorymodes">**clearCategoryModes**</span><br><code>() =&gt; void</code> |  |
| <span id="action-clearfiltertext">**clearFilterText**</span><br><code>() =&gt; void</code> |  |
| <span id="action-setfiltertext">**setFilterText**</span><br><code>(newText: string) =&gt; void</code> |  |
| <span id="action-opentable">**openTable**</span><br><code>(drawerWidth?: number) =&gt; void</code> | shows this view's tracks as a table in the drawer, at the drawer's current width |
| <span id="action-closetable">**closeTable**</span><br><code>() =&gt; void</code> |  |
| <span id="action-setpreferreddrawerwidth">**setPreferredDrawerWidth**</span><br><code>(width: number) =&gt; void</code> | a drag of the drawer edge while the table is open resizes the table's width, so closing it returns to the user's own |
| <span id="action-setcategorycollapsed">**setCategoryCollapsed**</span><br><code>(id: string, collapsed: boolean) =&gt; void</code> | the single gate on accordion state: a folder is a mode the user picked, not an accordion that happens to be shut, so every collapse/expand — one row, a bulk menu item, or "expand all" — passes it by |
| <span id="action-setfoldercategory">**setFolderCategory**</span><br><code>(id: string, isFolder: boolean) =&gt; void</code> | folder and collapsed are the same slot, so leaving folder mode always yields an expanded category |
| <span id="action-toggletrack">**toggleTrack**</span><br><code>(trackId: string) =&gt; Promise&lt;void&gt;</code> | shows or hides a track, recording one it showed as recently used |
| <span id="action-collapsesubcategories">**collapseSubCategories**</span><br><code>() =&gt; void</code> |  |
| <span id="action-collapsetoplevelcategories">**collapseTopLevelCategories**</span><br><code>() =&gt; void</code> |  |
| <span id="action-togglecategory">**toggleCategory**</span><br><code>(id: string) =&gt; void</code> | expanding a dormant connection's category loads the connection |
