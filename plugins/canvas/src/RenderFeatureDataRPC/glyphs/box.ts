import { layoutChild } from './glyphUtils.ts'

import type { FeatureLayout, LayoutArgs } from '../types.ts'

export function layoutBox(args: LayoutArgs): FeatureLayout {
  return layoutChild(args.feature, args)
}
