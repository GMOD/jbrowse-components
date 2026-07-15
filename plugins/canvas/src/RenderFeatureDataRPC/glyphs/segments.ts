import { layoutContainerGlyph } from './glyphUtils.ts'
import { getSubfeatures } from '../util.ts'

import type { FeatureLayout, LayoutArgs } from '../types.ts'

export function layoutSegments(args: LayoutArgs): FeatureLayout {
  return layoutContainerGlyph('Segments', args, getSubfeatures(args.feature))
}
