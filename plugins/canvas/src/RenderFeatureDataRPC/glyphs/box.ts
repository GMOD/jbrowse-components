import { boxLayout, featureHeightPx } from './glyphUtils.ts'

import type { FeatureLayout, LayoutArgs } from '../types.ts'

export function layoutBox(args: LayoutArgs): FeatureLayout {
  return boxLayout(args.feature, featureHeightPx(args.feature, args))
}
