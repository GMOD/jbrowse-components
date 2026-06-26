import { layoutBox } from './box.ts'
import { hasCDSSubfeature, hasContainerChildren } from './glyphUtils.ts'
import {
  hasMatureProteinChildren,
  layoutMatureProteinRegion,
} from './matureProteinRegion.ts'
import { layoutProcessedTranscript } from './processed.ts'
import { isRepeatRegion, layoutRepeatRegion } from './repeatRegion.ts'
import { layoutSegments } from './segments.ts'
import { layoutSubfeatures } from './subfeatures.ts'
import { featureType, getSubfeatures, isCDS } from '../util.ts'

import type { DisplayConfig } from '../renderConfig.ts'
import type { FeatureLayout, LayoutArgs } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

// Selects the layout function that best represents a feature's structure.
// When called from layoutSubfeatures for children, pass isTopLevel=false to
// skip container/nesting checks that only apply to root features.
//
// Layout categories:
//   Leaf (Box)         — single rect, strand arrows if top-level
//   Container          — parent rect + sorted children with intron lines
//     ProcessedTranscript — filtered subParts with implied UTRs
//     Segments            — raw subfeatures on one row
//   MatureProteinRegion — multi-row stacked protein regions
//   RepeatRegion        — transposon LTR/TSD/internal parts on one row, no
//                         parent box, internal body shortened under the LTRs
//   Subfeatures         — gene-level: stacks child transcripts vertically
export function findGlyph(
  feature: Feature,
  config: DisplayConfig,
  isTopLevel?: boolean,
): (args: LayoutArgs) => FeatureLayout {
  isTopLevel ??= !feature.parent?.()
  const type = featureType(feature)
  const hasSubfeatures = getSubfeatures(feature).length > 0

  if (isCDS(feature)) {
    return hasMatureProteinChildren(feature)
      ? layoutMatureProteinRegion
      : layoutBox
  }
  if (hasSubfeatures) {
    const { transcriptTypes, containerTypes } = config

    // Intact transposons (repeat_region → overlapping LTR/TSD/internal parts)
    // render their subparts on one row joined by a connecting line, with no box
    // for the parent, so the structure stays visible instead of collapsing to a
    // flat Segments box. Checked before the shapes below since a repeat_region
    // matches none of the transcript/container heuristics and would otherwise
    // fall through to Segments.
    if (isTopLevel && isRepeatRegion(feature)) {
      return layoutRepeatRegion
    }

    // Three container shapes, in precedence order:
    //   Subfeatures         — stack each child on its own row (gene → mRNAs)
    //   ProcessedTranscript — one row; filter to subParts and imply UTRs
    //   Segments            — one row of boxes joined by intron lines
    //
    // The "stack vertically" decision is mostly structural, not type-based: any
    // top-level feature whose children are themselves containers gets stacked.
    // That's why the common `gene` type is enumerated nowhere — a
    // gene → mRNA → exon tree is caught generically by hasContainerChildren, so
    // custom gene-like types work without configuration. containerTypes is the
    // explicit override for top-level types that must stack even when that
    // structural heuristic wouldn't fire (and it wins over the transcript check
    // below, hence it comes first).
    if (isTopLevel && containerTypes.includes(type)) {
      return layoutSubfeatures
    }
    if (transcriptTypes.includes(type) && hasCDSSubfeature(feature)) {
      return layoutProcessedTranscript
    }
    if (isTopLevel && hasContainerChildren(feature)) {
      return layoutSubfeatures
    }
    return layoutSegments
  }
  return layoutBox
}
