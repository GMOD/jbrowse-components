import { boxGlyph } from './box.ts'
import {
  hasMatureProteinChildren,
  matureProteinRegionGlyph,
} from './matureProteinRegion.ts'
import { processedTranscriptGlyph } from './processed.ts'
import { segmentsGlyph } from './segments.ts'
import { subfeaturesGlyph } from './subfeatures.ts'

import type { DisplayConfig } from '../renderConfig.ts'
import type { Feature } from '@jbrowse/core/util'

// Selects the glyph that best represents a feature's structure.
// When called from subfeaturesGlyph for children, pass isTopLevel=false to
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
) {
  if (isTopLevel === undefined) {
    isTopLevel = !feature.parent?.()
  }
  const type = feature.get('type') as string
  const subfeatures = feature.get('subfeatures')
  const hasSubfeatures = !!subfeatures?.length

  if (type === 'CDS') {
    return hasMatureProteinChildren(feature)
      ? matureProteinRegionGlyph
      : boxGlyph
  }
  if (hasSubfeatures) {
    const { transcriptTypes, containerTypes } = config
    if (isTopLevel && containerTypes.includes(type)) {
      return subfeaturesGlyph
    }
    const hasCDS = subfeatures.some((f: Feature) => f.get('type') === 'CDS')
    if (transcriptTypes.includes(type) && hasCDS) {
      return processedTranscriptGlyph
    }
    // Top-level features with nested subfeatures (e.g. gene→mRNA→CDS)
    // get the multi-row subfeatures glyph
    if (isTopLevel) {
      const hasNested = subfeatures.some(
        (f: Feature) => f.get('subfeatures')?.length,
      )
      if (hasNested) {
        return subfeaturesGlyph
      }
    }
    return segmentsGlyph
  }
  return boxGlyph
}
