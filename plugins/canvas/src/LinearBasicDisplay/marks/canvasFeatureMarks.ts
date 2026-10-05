import { featureGlyphMarks } from './featureGlyphMarks.ts'

import type { RegionRenderData } from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { RenderState } from '../components/canvasFeatureRenderingBackendTypes.ts'

export const CANVAS_FEATURE_MARKS = featureGlyphMarks<
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
