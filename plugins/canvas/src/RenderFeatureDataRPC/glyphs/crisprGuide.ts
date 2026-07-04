import { layoutChild } from './glyphUtils.ts'

import type { FeatureLayout, LayoutArgs } from '../types.ts'

// A CRISPR guide RNA (from CrisprGuideAdapter): a single-row glyph drawn as the
// protospacer box with the PAM overpainted in a distinct color and the predicted
// cut site marked. Geometry is a plain leaf box; the emitter reads the PAM
// subfeature and the `cutSite` attribute off the feature.
export function layoutCrisprGuide(args: LayoutArgs): FeatureLayout {
  return { ...layoutChild(args.feature, args), glyphType: 'CrisprGuide' }
}
