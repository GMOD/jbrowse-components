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
    // eslint-disable-next-line no-console
    console.log('[GPU] Rendering disabled via URL parameter')
    return null
  }

  if (override !== 'webgl') {
    try {
      console.log('[GPU] Attempting WebGPU init...')
      const webgpu = await WebGPUHal.create(canvas, passes, uniformByteSize)
      if (webgpu) {
        // eslint-disable-next-line no-console
        console.log('[GPU] Using WebGPU renderer')
        return webgpu
      }
      console.log('[GPU] WebGPU returned null, falling back to WebGL2')
    } catch (e) {
      console.warn(
        '[GPU] WebGPU initialization failed, falling back to WebGL2:',
        e,
      )
    }
  }

  try {
    console.log('[GPU] Attempting WebGL2 init...')
    const gl = new WebGL2Hal(canvas, passes, uniformByteSize)
    console.log('[GPU] WebGL2 init complete')
    return gl
  } catch (e) {
    console.error('[GPU] WebGL2 initialization failed:', e)
  }

  console.error('[GPU] No rendering backend available')
  return null
}
