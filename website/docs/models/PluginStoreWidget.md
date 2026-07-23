---
id: pluginstorewidget
title: PluginStoreWidget
sidebar_label: Widget -> PluginStoreWidget
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`data-management` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/data-management/src/PluginStoreWidget/model.ts).

## Overview

Widget backing the plugin store: holds the text filter applied to the
installable plugin list and the view it was opened from.

## Members

| Member                                 | Kind       | Defined by        | Description |
| -------------------------------------- | ---------- | ----------------- | ----------- |
| [id](#property-id)                     | Properties | PluginStoreWidget |             |
| [type](#property-type)                 | Properties | PluginStoreWidget |             |
| [filterText](#property-filtertext)     | Properties | PluginStoreWidget |             |
| [view](#property-view)                 | Properties | PluginStoreWidget |             |
| [setFilterText](#action-setfiltertext) | Actions    | PluginStoreWidget |             |

<details>
<summary>PluginStoreWidget - Properties</summary>

| Member                                           | Type                                               |
| ------------------------------------------------ | -------------------------------------------------- |
| <span id="property-id">id</span>                 | `IOptionalIType<ISimpleType<string>, [undefined]>` |
| <span id="property-type">type</span>             | `ISimpleType<"PluginStoreWidget">`                 |
| <span id="property-filtertext">filterText</span> | `string`                                           |
| <span id="property-view">view</span>             | `IMaybe<IReferenceType<IAnyType>>`                 |

</details>

<details>
<summary>PluginStoreWidget - Actions</summary>

| Member                                               | Type                        |
| ---------------------------------------------------- | --------------------------- |
| <span id="action-setfiltertext">setFilterText</span> | `(newText: string) => void` |

</details>
