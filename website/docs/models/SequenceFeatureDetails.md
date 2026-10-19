---
id: sequencefeaturedetails
title: SequenceFeatureDetails
description: "User preferences for the sequence readout under a feature's details, seeded from and written straight back to localStorage."
sidebar_label: Widget -> SequenceFeatureDetails
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/BaseFeatureWidget/SequenceFeatureDetails/model.ts).

User preferences for the sequence readout under a feature's details, seeded
from and written straight back to localStorage. The model is not snapshotted
and does not read the tree, so an instance is cheap and needs no lifecycle: a
holder that only sometimes shows a panel (e.g. a track's right-click dialog)
creates one when it opens and keeps none otherwise.

`BaseFeatureWidget` holds one as `sequenceFeatureDetails`, which is where a
caller changing the readout reaches these actions.

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-showcoordinatessetting">**showCoordinatesSetting**</span><br><code>ShowCoordinatesMode</code> |  |
| <span id="volatile-intronbp">**intronBp**</span><br><code>number</code> |  |
| <span id="volatile-updownbp">**upDownBp**</span><br><code>number</code> |  |
| <span id="volatile-uppercasecds">**upperCaseCDS**</span><br><code>boolean</code> |  |
| <span id="volatile-charactersperrow">**charactersPerRow**</span><br><code>number</code> | how wide a row of the readout is. Rows exist only while coordinates are shown — without them the panel wraps to its container — so this is what the labels step by, and the line width of the FASTA exported from that state. |
| <span id="volatile-recentmodes">**recentModes**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>("cdna" &#124; "cds" &#124; "gene" &#124; "gene_collapsed_intron" &#124; "gene_updo…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>("cdna" &#124; "cds" &#124; "gene" &#124; "gene_collapsed_intron" &#124; "gene_updownstream" &#124; "gene_updownstream_collapsed_intron" &#124; "genomic" &#124; "genomic_sequence_updownstream" &#124; "protein")[]</code></pre></dialog></span> | the sequence types picked in any panel, most recent first; `resolveMode` shows the first one a feature offers |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-showcoordinates">**showCoordinates**</span><br><code>boolean</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setupdownbp">**setUpDownBp**</span><br><code>(f: number) =&gt; void</code> |  |
| <span id="action-setintronbp">**setIntronBp**</span><br><code>(f: number) =&gt; void</code> |  |
| <span id="action-setuppercasecds">**setUpperCaseCDS**</span><br><code>(f: boolean) =&gt; void</code> |  |
| <span id="action-setcharactersperrow">**setCharactersPerRow**</span><br><code>(f: number) =&gt; void</code> |  |
| <span id="action-setshowcoordinates">**setShowCoordinates**</span><br><code>(f: ShowCoordinatesMode) =&gt; void</code> |  |
| <span id="action-setmode">**setMode**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(f: "cdna" &#124; "cds" &#124; "gene" &#124; "gene_collapsed_intron" &#124; "gene_u…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(f: "cdna" &#124; "cds" &#124; "gene" &#124; "gene_collapsed_intron" &#124; "gene_updownstream" &#124; "gene_updownstream_collapsed_intron" &#124; "genomic" &#124; "genomic_sequence_updownstream" &#124; "protein") =&gt; void</code></pre></dialog></span> |  |
