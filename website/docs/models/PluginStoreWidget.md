---
id: pluginstorewidget
title: PluginStoreWidget
description: "Widget backing the plugin store: holds the text and tag filters applied to the installable plugin list and the view it was opened from."
sidebar_label: Widget -> PluginStoreWidget
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/AppWidgets/PluginStoreWidget/model.ts).

Widget backing the plugin store: holds the text and tag filters applied to the
installable plugin list and the view it was opened from.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-id">**id**</span><br><code>ElementId</code> |  |
| <span id="property-type">**type**</span><br><code>types.literal('PluginStoreWidget')</code> |  |
| <span id="property-filtertext">**filterText**</span><br><code>''</code> |  |
| <span id="property-tagfilters">**tagFilters**</span><br><code>types.optional(types.array(types.string), [])</code> | Tags a plugin must have to stay in the list. Plain strings, because the tag vocabulary is published in the store manifest rather than defined here — a tag this build has never seen still filters correctly. |
| <span id="property-view">**view**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>types.safeReference( pluginManager.pluggableMstType('view', 'st…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>types.safeReference(&#10;&#160;&#160;pluginManager.pluggableMstType('view', 'stateModel'),&#10;)</code></pre></dialog></span> |  |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-selectedtags">**selectedTags**</span><br><code>Set&lt;string&gt;</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setfiltertext">**setFilterText**</span><br><code>(newText: string) =&gt; void</code> |  |
| <span id="action-toggletagfilter">**toggleTagFilter**</span><br><code>(tag: string) =&gt; void</code> |  |
| <span id="action-cleartagfilters">**clearTagFilters**</span><br><code>() =&gt; void</code> |  |
