import { createRenderingBackend } from '@jbrowse/render-core/createRenderingBackend'

import { Canvas2DFeatureRenderer } from './Canvas2DFeatureRenderer.ts'
import {
  CANVAS_FEATURE_PASSES,
  CANVAS_FEATURE_UNIFORM_BYTE_SIZE,
  GpuCanvasFeatureRenderer,
} from './GpuCanvasFeatureRenderer.ts'

export { type FeatureRenderBlock } from './canvasFeatureRenderingBackendTypes.ts'

import type { CanvasFeatureRenderingBackend } from './canvasFeatureRenderingBackendTypes.ts'

export function CanvasFeatureRenderer(canvas: HTMLCanvasElement) {
  return createRenderingBackend<CanvasFeatureRenderingBackend>(canvas, {
    passes: CANVAS_FEATURE_PASSES,
    uniformByteSize: CANVAS_FEATURE_UNIFORM_BYTE_SIZE,
    createGpuBackend: hal => new GpuCanvasFeatureRenderer(hal),
    createCanvas2DBackend: c => new Canvas2DFeatureRenderer(c),
  })
}
