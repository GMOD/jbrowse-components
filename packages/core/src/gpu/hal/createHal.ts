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

  if (override === 'canvas2d' || override === 'off') {
    return null
  }

  if (override !== 'webgl') {
    try {
      const webgpu = await WebGPUHal.create(canvas, passes, uniformByteSize)
      if (webgpu) {
        return webgpu
      }
    } catch {
      // WebGPU not available
    }
  }

  try {
    return new WebGL2Hal(canvas, passes, uniformByteSize)
  } catch {
    // WebGL2 not available
  }

  return null
}
