import { getGpuOverride } from '../gpuDevice.ts'
import { WebGL2Hal } from './webgl2Hal.ts'
import { WebGPUHal } from './webgpuHal.ts'

import type { GpuHal, PassDescriptor } from './types.ts'

// Ladder: WebGPU → WebGL2 → Canvas2D (null). `?renderer=` URL param can pin
// to webgl or canvas/canvas2d for debugging.
export async function createGpuHal(
  canvas: HTMLCanvasElement,
  passes: PassDescriptor[],
  uniformByteSize: number,
): Promise<GpuHal | null> {
  const override = getGpuOverride()
  if (override === 'canvas2d' || override === 'canvas') {
    return null
  }
  if (override !== 'webgl') {
    try {
      const webgpu = await WebGPUHal.create(canvas, passes, uniformByteSize)
      if (webgpu) {
        return webgpu
      }
    } catch (e) {
      console.warn('[GPU] WebGPU init failed, falling back to WebGL2:', e)
    }
  }
  try {
    return new WebGL2Hal(canvas, passes, uniformByteSize)
  } catch (e) {
    console.warn('[GPU] WebGL2 unavailable, falling back to Canvas2D:', e)
    return null
  }
}
