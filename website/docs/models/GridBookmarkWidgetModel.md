---
id: gridbookmarkwidgetmodel
title: GridBookmarkWidgetModel
sidebar_label: Widget -> GridBookmarkWidgetModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the `grid-bookmark` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/grid-bookmark/src/GridBookmarkWidget/model.ts).

the list of the session's highlights

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  |
| <span id="property-type">**type**</span><br><code>type: types.literal('GridBookmarkWidget')</code> |  |

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-selectedkeys">**selectedKeys**</span><br><code>selectedKeys: new Set&lt;string&gt;()</code> | a row's key holds its coordinates and its place in the session's list, so a key left stale by a removal elsewhere selects nothing rather than a neighbour |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-assembliesinviews">**assembliesInViews**</span><br><code>Set&lt;string&gt;</code> | assemblies currently displayed in any open view |
| <span id="getter-rows">**rows**</span><br><code>HighlightRow[]</code> | the list shows only highlights on an assembly some view is showing |
| <span id="getter-selectedhighlights">**selectedHighlights**</span><br><code>HighlightType[]</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setselectedkeys">**setSelectedKeys**</span><br><code>(keys: Set&lt;string&gt;) =&gt; void</code> |  |
| <span id="action-importhighlights">**importHighlights**</span><br><code>(highlights: HighlightType[]) =&gt; void</code> |  |
| <span id="action-removeselectedhighlights">**removeSelectedHighlights**</span><br><code>() =&gt; void</code> |  |
| <span id="action-recolorselectedhighlights">**recolorSelectedHighlights**</span><br><code>(color: string) =&gt; void</code> |  |
