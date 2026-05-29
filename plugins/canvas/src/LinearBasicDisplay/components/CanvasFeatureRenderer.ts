import { createRenderingBackend } from '@jbrowse/core/gpu/createRenderingBackend'

import { Canvas2DFeatureRenderer } from './Canvas2DFeatureRenderer.ts'
import {
  CANVAS_FEATURE_PASSES,
  CANVAS_FEATURE_UNIFORM_BYTE_SIZE,
  GpuCanvasFeatureRenderer,
} from './GpuCanvasFeatureRenderer.ts'

export { type FeatureRenderBlock } from './canvasFeatureRenderingBackendTypes.ts'

import type { CanvasFeatureRenderingBackend } from './canvasFeatureRenderingBackendTypes.ts'

export function CanvasFeatureRenderer(canvas: HTMLCanvasElement) {
  return createRenderingBackend<CanvasFeatureRenderingBackend>(
    canvas,
    CANVAS_FEATURE_PASSES,
    CANVAS_FEATURE_UNIFORM_BYTE_SIZE,
    hal => new GpuCanvasFeatureRenderer(hal),
    c => new Canvas2DFeatureRenderer(c),
  )
}
