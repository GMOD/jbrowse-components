import { layoutChild } from './glyphUtils.ts'

import type { FeatureLayout, LayoutArgs } from '../types.ts'

// A sequence motif (from MotifListAdapter): the recognition site box with its
// cut positions marked. Geometry is a plain leaf box; the emitter reads the
// `cutSite`/`cutSiteBottom` attributes and draws the staggered cut.
export function layoutMotif(args: LayoutArgs): FeatureLayout {
  return { ...layoutChild(args.feature, args), glyphType: 'Motif' }
}
