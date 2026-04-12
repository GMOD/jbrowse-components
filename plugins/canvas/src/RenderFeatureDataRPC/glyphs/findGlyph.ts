import { layoutBox } from './box.ts'
import {
  hasMatureProteinChildren,
  layoutMatureProteinRegion,
} from './matureProteinRegion.ts'
import { layoutProcessedTranscript } from './processed.ts'
import { layoutSegments } from './segments.ts'
import { layoutSubfeatures } from './subfeatures.ts'

import type { DisplayConfig } from '../renderConfig.ts'
import type { LayoutArgs, FeatureLayout } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

// Selects the layout function that best represents a feature's structure.
// When called from layoutSubfeatures for children, pass isTopLevel=false to
// skip container/nesting checks that only apply to root features.
//
// Layout categories:
//   Leaf (Box)         — single rect, strand arrows if top-level
//   Container          — parent rect + sorted children with intron lines
//     ProcessedTranscript — filtered subParts with implied UTRs
//     Segments            — raw subfeatures (also used for repeat_region)
//   MatureProteinRegion — multi-row stacked protein regions
//   Subfeatures         — gene-level: stacks child transcripts vertically
export function findGlyph(
  feature: Feature,
  config: DisplayConfig,
  isTopLevel?: boolean,
): (args: LayoutArgs) => FeatureLayout {
  if (isTopLevel === undefined) {
    isTopLevel = !feature.parent?.()
  }
  const type = feature.get('type') ?? ''
  const subfeatures = feature.get('subfeatures')
  const hasSubfeatures = !!subfeatures?.length

  if (type === 'CDS') {
    return hasMatureProteinChildren(feature)
      ? layoutMatureProteinRegion
      : layoutBox
  }
  if (hasSubfeatures) {
    const { transcriptTypes, containerTypes } = config
    if (isTopLevel && containerTypes.includes(type)) {
      return layoutSubfeatures
    }
    const hasCDS = subfeatures.some((f: Feature) => f.get('type') === 'CDS')
    if (transcriptTypes.includes(type) && hasCDS) {
      return layoutProcessedTranscript
    }
    // Top-level features with nested subfeatures (e.g. gene→mRNA→CDS)
    // get the multi-row subfeatures layout
    if (isTopLevel) {
      const hasNested = subfeatures.some(
        (f: Feature) => f.get('subfeatures')?.length,
      )
      if (hasNested) {
        return layoutSubfeatures
      }
    }
    return layoutSegments
  }
  return layoutBox
}
