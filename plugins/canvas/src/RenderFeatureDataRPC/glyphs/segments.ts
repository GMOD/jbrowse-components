import { layoutContainerGlyph } from './glyphUtils.ts'

import type { FeatureLayout, Glyph, LayoutArgs } from '../types.ts'

export const segmentsGlyph: Glyph = {
  type: 'Segments',

  layout(args: LayoutArgs): FeatureLayout {
    const subfeatures = args.feature.get('subfeatures') || []
    return layoutContainerGlyph('Segments', args, subfeatures)
  },
}
