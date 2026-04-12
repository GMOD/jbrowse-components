import { layoutContainerGlyph } from './glyphUtils.ts'

import type { FeatureLayout, LayoutArgs } from '../types.ts'

export function layoutSegments(args: LayoutArgs): FeatureLayout {
  const subfeatures = args.feature.get('subfeatures') || []
  return layoutContainerGlyph('Segments', args, subfeatures)
}
