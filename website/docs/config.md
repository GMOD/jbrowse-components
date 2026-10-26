---
title: Configuration schema
sidebar_label: All config types
description:
  Auto-generated reference for every JBrowse configuration type, grouped by
  category.
---

Auto-generated reference for every configuration type: the slots available on
each adapter, track, display, and other config object. These pages are generated
from the `configSchema` definitions in the source, so they always match the
current release.

For what the format is and where it is accepted, see [](/docs/automating); for
how configuration fits together, start with the
[config guide](/docs/config_guide). For the file formats each adapter reads, see
[supported file types](/docs/config_guides/file_types).

Each display's color channels, the `scale.type` values each takes, and the
fields with presets of their own:

<!-- COLOR_CHANNELS START -->

<!-- prettier-ignore -->
| Display | Setting | Page | `scale.type` | Preset fields |
| --- | --- | --- | --- | --- |
| [ChordVariantDisplay](/docs/config/chordvariantdisplay) | `encoding.color` | [ChordColor](/docs/config/chordcolor#preset-fields) | ordinal, threshold | `strand`, `svType`, `impact` |
| [LDTrackDisplay](/docs/config/ldtrackdisplay) | `encoding.color` | [LDColor](/docs/config/ldcolor#preset-fields) | linear | `r2`, `dprime` |
| [LGVSyntenyDisplay](/docs/config/lgvsyntenydisplay) | `encoding.color` | [LGVSyntenyColor](/docs/config/lgvsyntenycolor#preset-fields) | ordinal, linear, threshold | `strand`, `mapq`, `insertSize`, `firstOfPairStrand`, `pairOrientation`, `insertSizeAndOrientation`, `mateRefName` |
| [LinearAlignmentsDisplay](/docs/config/linearalignmentsdisplay) | `encoding.color` | [AlignmentsColor](/docs/config/alignmentscolor#preset-fields) | ordinal, linear, threshold | `strand`, `mapq`, `insertSize`, `firstOfPairStrand`, `pairOrientation`, `insertSizeAndOrientation`, `mateRefName` |
| [LinearBasicDisplay](/docs/config/linearbasicdisplay) | `encoding.color` | [FeatureColor](/docs/config/featurecolor#preset-fields) | ordinal, threshold, linear, log, identity | `strand`, `svType`, `impact`, `score` |
| [LinearHicDisplay](/docs/config/linearhicdisplay) | `encoding.color` | [HicColor](/docs/config/hiccolor#preset-fields) | linear, symlog, log | `observed`, `observed/expected`, `observed/control` |
| [LinearMafDisplay](/docs/config/linearmafdisplay) | `encoding.color` | [MafColor](/docs/config/mafcolor#preset-fields) | fixed by the field | `identity`, `refNameRank` |
| [LinearManhattanDisplay](/docs/config/linearmanhattandisplay) | `marks.encoding.color` | [MarkColor](/docs/config/markcolor#preset-fields) | ordinal, linear, log, symlog, threshold, identity | `strand`, `svType`, `impact`, `score` |
| [LinearManhattanDisplay](/docs/config/linearmanhattandisplay) | `encoding.color` | [MarkColor](/docs/config/markcolor#preset-fields) | ordinal, linear, log, symlog, threshold, identity | `strand`, `svType`, `impact`, `score` |
| [LinearMarkDisplay](/docs/config/linearmarkdisplay) | `marks.encoding.color` | [MarkColor](/docs/config/markcolor#preset-fields) | ordinal, linear, log, symlog, threshold, identity | `strand`, `svType`, `impact`, `score` |
| [LinearMarkDisplay](/docs/config/linearmarkdisplay) | `encoding.color` | [MarkColor](/docs/config/markcolor#preset-fields) | ordinal, linear, log, symlog, threshold, identity | `strand`, `svType`, `impact`, `score` |
| [LinearMultiRowFeatureDisplay](/docs/config/linearmultirowfeaturedisplay) | `marks.encoding.color` | [MarkColor](/docs/config/markcolor#preset-fields) | ordinal, linear, log, symlog, threshold, identity | `strand`, `svType`, `impact`, `score` |
| [LinearMultiRowFeatureDisplay](/docs/config/linearmultirowfeaturedisplay) | `encoding.color` | [MarkColor](/docs/config/markcolor#preset-fields) | ordinal, linear, log, symlog, threshold, identity | `strand`, `svType`, `impact`, `score` |
| [LinearMultiSampleVariantDisplay](/docs/config/linearmultisamplevariantdisplay) | `encoding.color` | [VariantCellColor](/docs/config/variantcellcolor#preset-fields) | ordinal, threshold | `strand`, `svType`, `impact` |
| [LinearVariantDisplay](/docs/config/linearvariantdisplay) | `encoding.color` | [FeatureColor](/docs/config/featurecolor#preset-fields) | ordinal, threshold, linear, log, identity | `strand`, `svType`, `impact`, `score` |
| [LinearWiggleDisplay](/docs/config/linearwiggledisplay) | `encoding.color` | [WiggleColor](/docs/config/wigglecolor) | linear, threshold |  |
| [MultiWaySyntenyDisplay](/docs/config/multiwaysyntenydisplay) | `encoding.color` | [MultiWayGeneColor](/docs/config/multiwaygenecolor#preset-fields) | ordinal, threshold | `strand`, `svType`, `impact` |
| [MultiWaySyntenyDisplay](/docs/config/multiwaysyntenydisplay) | `ribbons.encoding.color` | [RibbonColor](/docs/config/ribboncolor#preset-fields) | linear, threshold | `mapq`, `identity`, `dnds`, `syntenicDepth` |
| [MultiWaySyntenyDisplay](/docs/config/multiwaysyntenydisplay) | `laneLayers.marks.encoding.color` | [MarkColor](/docs/config/markcolor#preset-fields) | ordinal, linear, log, symlog, threshold, identity | `strand`, `svType`, `impact`, `score` |

<!-- COLOR_CHANNELS END -->

<!-- doclist:config grouped -->
