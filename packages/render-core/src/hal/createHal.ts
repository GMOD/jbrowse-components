import { getGpuOverride, isGpuRenderingDisabled } from '../gpuDevice.ts'
import { WebGL2Hal } from './webgl2Hal.ts'
import { WebGPUHal } from './webgpuHal.ts'

import type { GpuHal, PassDescriptor } from './types.ts'

// Ladder: WebGPU → WebGL2 → Canvas2D (null). The `?renderer=` URL param pins it
// to a single rung for debugging — `webgpu`, `webgl`, or `canvas2d`/`canvas` —
// and a pin never falls through to the next rung. See GPU_OVERRIDES.
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
    // A pin is not a preference. `?renderer=webgpu` used to be indistinguishable
    // from passing nothing — WebGPU is the first rung either way — so on a
    // machine where it declined, the page rendered on WebGL2 and said nothing,
    // and anyone using the flag to compare the two backends measured WebGL2
    // twice. Fail where it can be seen instead. The other pins already behave
    // this way: `webgl` skips this rung, `canvas2d` returns null above.
    if (override === 'webgpu') {
      const message =
        'WebGPU was pinned with ?renderer=webgpu but no WebGPU backend could be created. Not falling back to WebGL2 — a pinned renderer that silently substitutes another makes any comparison against it wrong. Drop the parameter for the default WebGPU → WebGL2 → Canvas2D ladder.'
      throw failures?.length
        ? new AggregateError(failures, message)
        : new Error(message)
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
