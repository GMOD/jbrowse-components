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
  console.warn(
    `[GPU] createGpuHal called, override=${override}, canvas.width=${canvas.width}, canvas.height=${canvas.height}`,
  )

  if (override === 'canvas2d' || override === 'canvas') {
    console.warn('[GPU] Canvas2D override, skipping GPU HAL creation')
    return null
  }

  if (override !== 'webgl') {
    try {
      console.warn('[GPU] Attempting WebGPU HAL creation')
      const webgpu = await WebGPUHal.create(canvas, passes, uniformByteSize)
      if (webgpu) {
        console.warn('[GPU] WebGPU HAL created successfully')
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
    console.warn('[GPU] Creating WebGL2 HAL')
    return new WebGL2Hal(canvas, passes, uniformByteSize)
  } catch (e) {
    console.error('[GPU] WebGL2 initialization failed:', e)
  }

  console.error('[GPU] No rendering backend available')
  return null
}
