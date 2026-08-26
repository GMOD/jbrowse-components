---
id: ucscresultswidget
title: UcscResultsWidget
sidebar_label: Widget -> UcscResultsWidget
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the `blat` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/blat/src/UcscResultsWidget/stateModel.ts).

The hit table for one UCSC BLAT or in-silico PCR query. The features are the
same ones the result track was built from, so the list and the track can't
disagree.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-id">**id**</span><br><code>id: types.identifier</code> |  |
| <span id="property-type">**type**</span><br><code>type: types.literal('UcscResultsWidget')</code> |  |
| <span id="property-features">**features**</span><br><code>features: types.frozen&lt;SimpleFeatureSerialized[]&gt;([])</code> | hits, best first (BLAT sorts by score; hgPcr returns products in order) |
| <span id="property-assembly">**assembly**</span><br><code>assembly: types.string</code> | assembly the hits are on, for navigating and for the header line |
| <span id="property-trackname">**trackName**</span><br><code>trackName: types.string</code> | name of the on-the-fly track these hits were added as |
| <span id="property-resultnoun">**resultNoun**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>resultNoun: types.optional(types.enumeration(['hit', 'product']…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>resultNoun: types.optional(types.enumeration(['hit', 'product']), 'hit')</code></pre></dialog></span> | what one result is called. A BLAT result is a hit; an hgPcr result is a product, which is a band on a gel — the word a bench scientist reasons in, and "2 hits" understates what two of them mean for a PCR run |
