---
id: mafsequencewidget
title: MafSequenceWidget
sidebar_label: Widget -> MafSequenceWidget
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`maf` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/MafSequenceWidget/stateModelFactory.ts).

## Overview

Widget showing multiple-alignment (MAF) sequence for a set of samples over the
connected view's regions, with per-row hover highlight state.

## Members

| Member                                         | Kind       | Defined by        | Description |
| ---------------------------------------------- | ---------- | ----------------- | ----------- |
| [id](#property-id)                             | Properties | MafSequenceWidget |             |
| [type](#property-type)                         | Properties | MafSequenceWidget |             |
| [adapterConfig](#property-adapterconfig)       | Properties | MafSequenceWidget |             |
| [samples](#property-samples)                   | Properties | MafSequenceWidget |             |
| [regions](#property-regions)                   | Properties | MafSequenceWidget |             |
| [connectedViewId](#property-connectedviewid)   | Properties | MafSequenceWidget |             |
| [hoverHighlight](#volatile-hoverhighlight)     | Volatiles  | MafSequenceWidget |             |
| [setHoverHighlight](#action-sethoverhighlight) | Actions    | MafSequenceWidget |             |

<details>
<summary>MafSequenceWidget - Properties</summary>

| Member                                                     | Type                                                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| <span id="property-id">id</span>                           | `ISimpleType<string>`                                                                |
| <span id="property-type">type</span>                       | `ISimpleType<"MafSequenceWidget">`                                                   |
| <span id="property-adapterconfig">adapterConfig</span>     | `IType<…>`                                                                           |
| <span id="property-samples">samples</span>                 | `IType<Sample[] \| null \| undefined, Sample[] \| undefined, Sample[] \| undefined>` |
| <span id="property-regions">regions</span>                 | `IType<…>`                                                                           |
| <span id="property-connectedviewid">connectedViewId</span> | `IMaybe<ISimpleType<string>>`                                                        |

</details>

<details>
<summary>MafSequenceWidget - Volatiles</summary>

| Member                                                   | Type                          |
| -------------------------------------------------------- | ----------------------------- |
| <span id="volatile-hoverhighlight">hoverHighlight</span> | `HoverHighlight \| undefined` |

</details>

<details>
<summary>MafSequenceWidget - Actions</summary>

| Member                                                       | Type                                               |
| ------------------------------------------------------------ | -------------------------------------------------- |
| <span id="action-sethoverhighlight">setHoverHighlight</span> | `(highlight: HoverHighlight \| undefined) => void` |

</details>
