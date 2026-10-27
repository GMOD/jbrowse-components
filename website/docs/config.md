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

The table below lists each display's color channels, the `scale.type` values
each takes, and the fields with presets of their own.

<!-- COLOR_CHANNELS START -->

<!-- prettier-ignore -->
| Display | Setting | Page | `scale.type` | Preset fields |
| --- | --- | --- | --- | --- |
| [](/docs/config/chordvariantdisplay) | `encoding.color` | [](/docs/config/chordcolor#preset-fields) | ordinal, threshold | `strand`, `svType`, `impact` |
| [](/docs/config/ldtrackdisplay) | `encoding.color` | [](/docs/config/ldcolor#preset-fields) | linear | `r2`, `dprime` |
| [](/docs/config/lgvsyntenydisplay) | `encoding.color` | [](/docs/config/lgvsyntenycolor#preset-fields) | ordinal, linear, threshold | `strand`, `mapq`, `insertSize`, `firstOfPairStrand`, `pairOrientation`, `insertSizeAndOrientation`, `mateRefName` |
| [](/docs/config/linearalignmentsdisplay) | `encoding.color` | [](/docs/config/alignmentscolor#preset-fields) | ordinal, linear, threshold | `strand`, `mapq`, `insertSize`, `firstOfPairStrand`, `pairOrientation`, `insertSizeAndOrientation`, `mateRefName` |
| [](/docs/config/linearbasicdisplay) | `encoding.color` | [](/docs/config/featurecolor#preset-fields) | ordinal, threshold, linear, log, identity | `strand`, `svType`, `impact`, `score` |
| [](/docs/config/linearhicdisplay) | `encoding.color` | [](/docs/config/hiccolor#preset-fields) | linear, symlog, log | `observed`, `observed/expected`, `observed/control` |
| [](/docs/config/linearmafdisplay) | `encoding.color` | [](/docs/config/mafcolor#preset-fields) | fixed by the field | `identity`, `refNameRank` |
| [](/docs/config/linearmanhattandisplay) | `marks.encoding.color` | [](/docs/config/markcolor#preset-fields) | ordinal, linear, log, symlog, threshold, identity | `strand`, `svType`, `impact`, `score` |
| [](/docs/config/linearmanhattandisplay) | `encoding.color` | [](/docs/config/markcolor#preset-fields) | ordinal, linear, log, symlog, threshold, identity | `strand`, `svType`, `impact`, `score` |
| [](/docs/config/linearmarkdisplay) | `marks.encoding.color` | [](/docs/config/markcolor#preset-fields) | ordinal, linear, log, symlog, threshold, identity | `strand`, `svType`, `impact`, `score` |
| [](/docs/config/linearmarkdisplay) | `encoding.color` | [](/docs/config/markcolor#preset-fields) | ordinal, linear, log, symlog, threshold, identity | `strand`, `svType`, `impact`, `score` |
| [](/docs/config/linearmultirowfeaturedisplay) | `marks.encoding.color` | [](/docs/config/markcolor#preset-fields) | ordinal, linear, log, symlog, threshold, identity | `strand`, `svType`, `impact`, `score` |
| [](/docs/config/linearmultirowfeaturedisplay) | `encoding.color` | [](/docs/config/markcolor#preset-fields) | ordinal, linear, log, symlog, threshold, identity | `strand`, `svType`, `impact`, `score` |
| [](/docs/config/linearmultisamplevariantdisplay) | `encoding.color` | [](/docs/config/variantcellcolor#preset-fields) | ordinal, threshold, linear, log | `strand`, `svType`, `impact`, `score` |
| [](/docs/config/linearvariantdisplay) | `encoding.color` | [](/docs/config/featurecolor#preset-fields) | ordinal, threshold, linear, log, identity | `strand`, `svType`, `impact`, `score` |
| [](/docs/config/linearwiggledisplay) | `encoding.color` | [](/docs/config/wigglecolor) | linear, threshold |  |
| [](/docs/config/multiwaysyntenydisplay) | `encoding.color` | [](/docs/config/multiwaygenecolor#preset-fields) | ordinal, threshold, linear, log | `strand`, `svType`, `impact`, `score` |
| [](/docs/config/multiwaysyntenydisplay) | `ribbons.encoding.color` | [](/docs/config/ribboncolor#preset-fields) | linear, threshold, ordinal | `mapq`, `identity`, `dnds`, `syntenicDepth` |
| [](/docs/config/multiwaysyntenydisplay) | `laneLayers.marks.encoding.color` | [](/docs/config/markcolor#preset-fields) | ordinal, linear, log, symlog, threshold, identity | `strand`, `svType`, `impact`, `score` |

<!-- COLOR_CHANNELS END -->

<!-- doclist:config grouped -->
