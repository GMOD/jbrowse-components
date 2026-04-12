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
        const format = navigator.gpu.getPreferredCanvasFormat()
        context.configure({
          device,
          format,
          alphaMode: opts?.alphaMode ?? 'premultiplied',
        })
        console.log('[initGpuContext] configured ok')
        return { device, context }
      }
      console.warn(
        '[initGpuContext] WebGPU device available but canvas context failed',
      )
    } catch (e) {
      console.warn('[initGpuContext] WebGPU context setup failed:', e)
    }
  }
  return undefined
}
