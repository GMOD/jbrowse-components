import { getSubparts } from '../filterSubparts.ts'
import { layoutContainerGlyph } from './glyphUtils.ts'

import type { FeatureLayout, Glyph, LayoutArgs } from '../types.ts'

export const processedTranscriptGlyph: Glyph = {
  type: 'ProcessedTranscript',

  layout(args: LayoutArgs): FeatureLayout {
    // getSubparts filters to configured subParts and synthesizes implied UTRs
    const subparts = getSubparts(args.feature, args.config)
    return layoutContainerGlyph('ProcessedTranscript', args, subparts)
  },
}
