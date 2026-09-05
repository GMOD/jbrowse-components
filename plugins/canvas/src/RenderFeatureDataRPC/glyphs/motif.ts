import { layoutChild } from './glyphUtils.ts'

import type { FeatureLayout, LayoutArgs } from '../types.ts'

export function layoutMotif(args: LayoutArgs): FeatureLayout {
  return { ...layoutChild(args.feature, args), glyphType: 'Motif' }
}
