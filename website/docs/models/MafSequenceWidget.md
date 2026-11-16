---
id: mafsequencewidget
title: MafSequenceWidget
description: "Widget showing multiple-alignment (MAF) sequence for a set of samples over the connected view's regions, with per-row hover highlight state."
sidebar_label: Widget -> MafSequenceWidget
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source. See the [developer guide](/docs/developer_guide/) for concepts. Provided by the `maf` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/MafSequenceWidget/stateModelFactory.ts).

Widget showing multiple-alignment (MAF) sequence for a set of samples over the
connected view's regions, with per-row hover highlight state.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-id">**id**</span><br><code>string</code> | The identifier references to this node resolve through. A snapshot must set it. |
| <span id="property-type">**type**</span><br><code>"MafSequenceWidget"</code> | Always `"MafSequenceWidget"`, the name a snapshot selects this model by. |
| <span id="property-adapterconfig">**adapterConfig**</span><br><code>Record&lt;string, unknown&gt; &#124; undefined</code> · default <code>undefined</code> |  |
| <span id="property-bytelimit">**byteLimit**</span><br><code>number &#124; undefined</code> · default <code>undefined</code> |  |
| <span id="property-samples">**samples**</span><br><code>MafRow[] &#124; undefined</code> · default <code>undefined</code> |  |
| <span id="property-regions">**regions**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ refName: string; start: number; end: number; … }[] &#124; undefined</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ refName: string; start: number; end: number; assemblyName: string; }[] &#124; undefined</code></pre></dialog></span> · default <code>undefined</code> |  |
| <span id="property-connectedviewid">**connectedViewId**</span><br><code>string &#124; undefined</code> |  |

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
