---
id: pluginstorewidget
title: PluginStoreWidget
sidebar_label: Widget -> PluginStoreWidget
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`data-management` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/data-management/src/PluginStoreWidget/model.ts).

Widget backing the plugin store: holds the text filter applied to the
installable plugin list and the view it was opened from.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  |
| <span id="property-type">**type**</span><br><code>type: types.literal('PluginStoreWidget')</code> |  |
| <span id="property-filtertext">**filterText**</span><br><code>filterText: ''</code> |  |
| <span id="property-view">**view**</span><br><details><summary><code>view: types.safeReference( pluginManager.pluggableMstType('view…</code></summary><pre><code>view: types.safeReference(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;pluginManager.pluggableMstType('view', 'stateModel'),&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></details> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setfiltertext">**setFilterText**</span><br><code>(newText: string) =&gt; void</code> |  |
