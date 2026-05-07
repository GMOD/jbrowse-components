import { initDualBackend } from '@jbrowse/core/gpu/createDualRenderer'

import { Canvas2DFeatureRenderer } from './Canvas2DFeatureRenderer.ts'
import {
  CANVAS_FEATURE_PASSES,
  CANVAS_FEATURE_UNIFORM_BYTE_SIZE,
  GpuCanvasFeatureRenderer,
} from './GpuCanvasFeatureRenderer.ts'

export { type FeatureRenderBlock } from './canvasFeatureBackendTypes.ts'

import type { CanvasFeatureBackend } from './canvasFeatureBackendTypes.ts'

export function CanvasFeatureRenderer(canvas: HTMLCanvasElement) {
  return initDualBackend<CanvasFeatureBackend>(
    canvas,
    CANVAS_FEATURE_PASSES,
    CANVAS_FEATURE_UNIFORM_BYTE_SIZE,
    hal => new GpuCanvasFeatureRenderer(hal),
    c => new Canvas2DFeatureRenderer(c),
  )
}
