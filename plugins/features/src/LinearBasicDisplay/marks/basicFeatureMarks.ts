import { featureGlyphMarks } from './featureGlyphMarks.ts'

import type { RegionRenderData } from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { RenderState } from '../components/featureRenderingBackendTypes.ts'

export const BASIC_FEATURE_MARKS = featureGlyphMarks<
  RegionRenderData,
  RenderState
>({
  glyphs: d => d,
  params: s => ({
    scrollY: s.scrollY,
    outlineColor: s.outlineColor,
    hideChevrons: s.hideChevrons,
  }),
  continuation: true,
})
