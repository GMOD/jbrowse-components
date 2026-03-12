/// <reference types="@webgpu/types" />

import getGpuDevice from './getGpuDevice.ts'

export async function initGpuContext(
  canvas: HTMLCanvasElement,
  opts?: { alphaMode?: GPUCanvasAlphaMode },
) {
  const device = await getGpuDevice()
  if (device) {
    try {
      const context = canvas.getContext('webgpu')
      if (context) {
        context.configure({
          device,
          format: 'bgra8unorm',
          alphaMode: opts?.alphaMode ?? 'premultiplied',
        })
        return { device, context }
      }
      console.error(
        '[initGpuContext] WebGPU device available but canvas context failed',
      )
    } catch (e) {
      console.error('[initGpuContext] WebGPU context setup failed:', e)
    }
  }
  return undefined
}
