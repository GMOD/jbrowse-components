import { getSubparts } from '../filterSubparts.ts'
import { layoutContainerGlyph } from './glyphUtils.ts'

import type { FeatureLayout, LayoutArgs } from '../types.ts'

// getSubparts filters to configured subParts and synthesizes implied UTRs
export function layoutProcessedTranscript(args: LayoutArgs): FeatureLayout {
  const subparts = getSubparts(args.feature, args.config)
  return layoutContainerGlyph('ProcessedTranscript', args, subparts)
}
