---
id: mafsequencewidget
title: MafSequenceWidget
sidebar_label: Widget -> MafSequenceWidget
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the `maf` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/MafSequenceWidget/stateModelFactory.ts).

Widget showing multiple-alignment (MAF) sequence for a set of samples over the
connected view's regions, with per-row hover highlight state.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-id">**id**</span><br><code>id: types.identifier</code> |  |
| <span id="property-type">**type**</span><br><code>type: types.literal('MafSequenceWidget')</code> |  |
| <span id="property-adapterconfig">**adapterConfig**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>adapterConfig: types.frozen&lt;AnyConfigurationModel &#124; undefined&gt;(…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>adapterConfig: types.frozen&lt;AnyConfigurationModel &#124; undefined&gt;(undefined)</code></pre></dialog></span> |  |
| <span id="property-samples">**samples**</span><br><code>samples: types.frozen&lt;Sample[] &#124; undefined&gt;(undefined)</code> |  |
| <span id="property-regions">**regions**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>regions: types.frozen&lt; &#124; { refName: string start: number end: n…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>regions: types.frozen&lt;&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#124; {&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;refName: string&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;start: number&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;end: number&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;assemblyName: string&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;}[]&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#124; undefined&#10;&#160;&#160;&#160;&#160;&#160;&#160;&gt;(undefined)</code></pre></dialog></span> |  |
| <span id="property-connectedviewid">**connectedViewId**</span><br><code>connectedViewId: types.maybe(types.string)</code> |  |

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-hoverhighlight">**hoverHighlight**</span><br><code>hoverHighlight: undefined as HoverHighlight &#124; undefined</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-sethoverhighlight">**setHoverHighlight**</span><br><code>(highlight: HoverHighlight &#124; undefined) =&gt; void</code> |  |
