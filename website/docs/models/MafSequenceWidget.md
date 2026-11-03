---
id: mafsequencewidget
title: MafSequenceWidget
description: "Widget showing multiple-alignment (MAF) sequence for a set of samples over the connected view's regions, with per-row hover highlight state."
sidebar_label: Widget -> MafSequenceWidget
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Provided by the `maf` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/MafSequenceWidget/stateModelFactory.ts).

Widget showing multiple-alignment (MAF) sequence for a set of samples over the
connected view's regions, with per-row hover highlight state.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-id">**id**</span><br><code>types.identifier</code> |  |
| <span id="property-type">**type**</span><br><code>types.literal('MafSequenceWidget')</code> |  |
| <span id="property-adapterconfig">**adapterConfig**</span><br><code>types.frozen&lt;Record&lt;string, unknown&gt; &#124; undefined&gt;( undefined, )</code> |  |
| <span id="property-bytelimit">**byteLimit**</span><br><code>types.frozen&lt;number &#124; undefined&gt;(undefined)</code> |  |
| <span id="property-samples">**samples**</span><br><code>types.frozen&lt;MafSource[] &#124; undefined&gt;(undefined)</code> |  |
| <span id="property-regions">**regions**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>types.frozen&lt; &#124; { refName: string start: number end: number ass…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>types.frozen&lt;&#10;&#160;&#160;&#124; {&#10;&#160;&#160;&#160;&#160;&#160;&#160;refName: string&#10;&#160;&#160;&#160;&#160;&#160;&#160;start: number&#10;&#160;&#160;&#160;&#160;&#160;&#160;end: number&#10;&#160;&#160;&#160;&#160;&#160;&#160;assemblyName: string&#10;&#160;&#160;&#160;&#160;}[]&#10;&#160;&#160;&#124; undefined&#10;&gt;(undefined)</code></pre></dialog></span> |  |
| <span id="property-connectedviewid">**connectedViewId**</span><br><code>types.maybe(types.string)</code> |  |

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-hoverhighlight">**hoverHighlight**</span><br><code>HoverHighlight &#124; undefined</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-sethoverhighlight">**setHoverHighlight**</span><br><code>(highlight: HoverHighlight &#124; undefined) =&gt; void</code> |  |
