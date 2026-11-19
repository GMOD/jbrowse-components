---
id: pluginstorewidget
title: PluginStoreWidget
description: "Widget backing the plugin store: holds the text and tag filters applied to the installable plugin list."
sidebar_label: Widget -> PluginStoreWidget
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source. See the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/AppWidgets/PluginStoreWidget/model.ts).

Widget backing the plugin store: holds the text and tag filters applied to the
installable plugin list.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-id">**id**</span><br><code>string</code> · default <code>createElementId()</code> | The identifier references to this node resolve through. A snapshot that leaves it out gets a generated one. |
| <span id="property-type">**type**</span><br><code>"PluginStoreWidget"</code> | Always `"PluginStoreWidget"`, the name a snapshot selects this model by. |
| <span id="property-filtertext">**filterText**</span><br><code>string</code> · default <code>''</code> |  |
| <span id="property-tagfilters">**tagFilters**</span><br><code>string[]</code> · default <code>[]</code> | Tags a plugin must have to stay in the list. Plain strings, because the tag vocabulary is published in the store manifest rather than defined here — a tag this build has never seen still filters correctly. |

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
