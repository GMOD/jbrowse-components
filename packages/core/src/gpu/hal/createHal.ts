import { getGpuOverride } from '../getGpuDevice.ts'
import { WebGL2Hal } from './webgl2Hal.ts'
import { WebGPUHal } from './webgpuHal.ts'

import type { GpuHal, PassDescriptor } from './types.ts'

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
      console.warn(
        '[GPU] WebGPU initialization failed, falling back to WebGL2:',
        e,
      )
    }
  }

  try {
    return new WebGL2Hal(canvas, passes, uniformByteSize)
  } catch (e) {
    console.warn('[GPU] WebGL2 unavailable, falling back to Canvas2D:', e)
    return null
  }
}
