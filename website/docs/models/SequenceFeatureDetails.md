---
id: sequencefeaturedetails
title: SequenceFeatureDetails
sidebar_label: Widget -> SequenceFeatureDetails
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/BaseFeatureWidget/SequenceFeatureDetails/model.ts).

User preferences for the sequence readout under a feature's details, seeded
from and written straight back to localStorage. Nothing here is snapshotted
or reads the tree, so an instance is cheap and needs no lifecycle: a holder
that only sometimes shows a panel (e.g. a track's right-click dialog) creates
one when it opens rather than carrying it around.

`BaseFeatureWidget` holds one as `sequenceFeatureDetails`, which is where a
caller changing the readout reaches these actions.

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-showcoordinatessetting">**showCoordinatesSetting**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>showCoordinatesSetting: parseShowCoordinatesMode( localStorageG…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>showCoordinatesSetting: parseShowCoordinatesMode(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;localStorageGetItem(`${p}-showCoordinatesSetting`),&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  |
| <span id="volatile-intronbp">**intronBp**</span><br><code>intronBp: localStorageGetNumber(`${p}-intronBp`, 10)</code> |  |
| <span id="volatile-updownbp">**upDownBp**</span><br><code>upDownBp: localStorageGetNumber(`${p}-upDownBp`, 100)</code> |  |
| <span id="volatile-uppercasecds">**upperCaseCDS**</span><br><code>upperCaseCDS: localStorageGetBoolean(`${p}-upperCaseCDS`, true)</code> |  |
| <span id="volatile-charactersperrow">**charactersPerRow**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>charactersPerRow: clampCharactersPerRow( localStorageGetNumber(…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>charactersPerRow: clampCharactersPerRow(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;localStorageGetNumber(`${p}-charactersPerRow`, 100),&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | how wide a row of the readout is. Rows exist only while coordinates are shown — without them the panel wraps to its container — so this is what the labels step by, and the line width of the FASTA exported from that state. |

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
