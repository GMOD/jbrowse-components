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
    // eslint-disable-next-line no-console
    console.log('[GPU] Rendering disabled via URL parameter')
    return null
  }

  if (override !== 'webgl') {
    try {
      const webgpu = await WebGPUHal.create(canvas, passes, uniformByteSize)
      if (webgpu) {
        // eslint-disable-next-line no-console
        console.log('[GPU] Using WebGPU renderer')
        return webgpu
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log(
        '[GPU] WebGPU initialization failed, falling back to WebGL2:',
        e,
      )
    }
  }

  try {
    return new WebGL2Hal(canvas, passes, uniformByteSize)
  } catch (e) {
    console.error('[GPU] WebGL2 initialization failed:', e)
  }

  console.error('[GPU] No rendering backend available')
  return null
}
