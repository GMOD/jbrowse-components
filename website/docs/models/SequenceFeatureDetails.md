---
id: sequencefeaturedetails
title: SequenceFeatureDetails
description: "User preferences for the sequence readout under a feature's details, seeded from and written straight back to localStorage. Nothing here is snapshotted or reads the tree, so an instance is cheap and…"
sidebar_label: Widget -> SequenceFeatureDetails
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/BaseFeatureWidget/SequenceFeatureDetails/model.ts).

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
| <span id="volatile-showcoordinatessetting">**showCoordinatesSetting**</span><br><code>ShowCoordinatesMode</code> |  |
| <span id="volatile-intronbp">**intronBp**</span><br><code>number</code> |  |
| <span id="volatile-updownbp">**upDownBp**</span><br><code>number</code> |  |
| <span id="volatile-uppercasecds">**upperCaseCDS**</span><br><code>boolean</code> |  |
| <span id="volatile-charactersperrow">**charactersPerRow**</span><br><code>number</code> | how wide a row of the readout is. Rows exist only while coordinates are shown — without them the panel wraps to its container — so this is what the labels step by, and the line width of the FASTA exported from that state. |

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
