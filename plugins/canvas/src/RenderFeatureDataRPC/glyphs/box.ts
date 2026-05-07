import { getFeatureHeightPx } from './glyphUtils.ts'

import type { FeatureLayout, LayoutArgs } from '../types.ts'

export function layoutBox(args: LayoutArgs): FeatureLayout {
  const heightPx = getFeatureHeightPx(args.feature, args.config)
  return {
    feature: args.feature,
    glyphType: 'Box',
    y: 0,
    height: heightPx,
    totalLayoutHeight: heightPx,
    children: [],
  }
}
