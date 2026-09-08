import { MAX_VISIBLE_CHEVRONS_PER_LINE } from '../components/sharedRendererConstants.ts'
import { featureGlyphMarks } from './featureGlyphMarks.ts'

import type { RegionRenderData } from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { RenderState } from '../components/canvasFeatureRenderingBackendTypes.ts'

export const CANVAS_FEATURE_MARKS = featureGlyphMarks<
  RegionRenderData,
  RenderState
>({
  glyphs: d => d,
  params: (s, d) => ({ scrollY: s.scrollY, outlineColor: d.outlineColor }),
  maxChevronsPerLine: MAX_VISIBLE_CHEVRONS_PER_LINE,
  continuation: true,
})
