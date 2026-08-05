import { getGpuOverride, isGpuRenderingDisabled } from '../gpuDevice.ts'
import { WebGL2Hal } from './webgl2Hal.ts'
import { WebGPUHal } from './webgpuHal.ts'

import type { GpuHal, PassDescriptor } from './types.ts'

// Ladder: WebGPU → WebGL2 → Canvas2D (null). `?renderer=` URL param can pin
// to webgl or canvas/canvas2d for debugging.
//
// `failures` is an optional out-parameter collecting why each rung declined, in
// ladder order. Falling through a rung is normal (no WebGPU on this machine) and
// stays a `console.warn` — but when the *last* rung fails too, the reasons the
// earlier ones gave are the diagnosis, and they used to exist only in a console
// the user reporting the bug never opens. `createRenderingBackend` attaches this
// to the error it throws, and the error UI's stack-trace dialog already walks
// `AggregateError.errors` (core's `formatErrorStack`), so they arrive with it.
export async function createGpuHal(
  canvas: HTMLCanvasElement,
  passes: PassDescriptor[],
  uniformByteSize: number,
  failures?: unknown[],
): Promise<GpuHal | null> {
  if (isGpuRenderingDisabled()) {
    return null
  }
  const override = getGpuOverride()
  if (override !== 'webgl') {
    try {
      const webgpu = await WebGPUHal.create(canvas, passes, uniformByteSize)
      if (webgpu) {
        return webgpu
      }
      // `create` returns null only for "no WebGPU device on this machine",
      // which is the ordinary path on most hardware and not worth recording as
      // a failure; every other way it can decline now throws.
    } catch (e) {
      console.warn('[GPU] WebGPU init failed, falling back to WebGL2:', e)
      failures?.push(e)
    }
  }
  try {
    return new WebGL2Hal(canvas, passes, uniformByteSize)
  } catch (e) {
    console.warn('[GPU] WebGL2 unavailable, falling back to Canvas2D:', e)
    failures?.push(e)
    return null
  }
}
