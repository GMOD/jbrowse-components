import { layoutBox } from './box.ts'

import type { FeatureLayout, LayoutArgs } from '../types.ts'

export function layoutMotif(args: LayoutArgs): FeatureLayout {
  return { ...layoutBox(args), glyphType: 'Motif' }
}
