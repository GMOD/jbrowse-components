import { createGpuHal } from './hal/index.ts'

import type { GpuHal, PassDescriptor } from './hal/types.ts'

/**
 * Options for `createRenderingBackend`. The two factories are an options object
 * (not positional args) on purpose: both are single-arg `(x) => new Backend(x)`
 * lambdas, so positionally they're trivially swappable by mistake — naming them
 * makes the GPU vs Canvas2D path unambiguous at every call site.
 */
export interface RenderingBackendOptions<TRenderingBackend> {
  passes: PassDescriptor[]
  uniformByteSize: number
  createGpuBackend: (hal: GpuHal) => TRenderingBackend
  createCanvas2DBackend: (canvas: HTMLCanvasElement) => TRenderingBackend
}

export async function createRenderingBackend<TRenderingBackend>(
  canvas: HTMLCanvasElement,
  {
    passes,
    uniformByteSize,
    createGpuBackend,
    createCanvas2DBackend,
  }: RenderingBackendOptions<TRenderingBackend>,
): Promise<TRenderingBackend> {
  const hal = await createGpuHal(canvas, passes, uniformByteSize)
  return hal ? createGpuBackend(hal) : createCanvas2DBackend(canvas)
}

/**
 * Factory for a **Canvas2D-only** display — one that ships no GPU shader path.
 *
 * Every display must already provide a Canvas2D draw function (SVG export needs
 * it), so for a display whose data volume never demands the GPU (gene-scale
 * annotations, low-density score tracks, text/sequence), the GPU renderer +
 * shader are pure overhead. Such a display skips `createRenderingBackend`'s HAL
 * ladder entirely and returns its Canvas2D backend directly through this
 * helper. The backend then plugs into the exact same `RenderLifecycleMixin` /
 * `DisplayChrome` machinery as a GPU display — the lifecycle is backend-
 * agnostic, so nothing downstream knows or cares there's no HAL.
 *
 * Reference: `plugins/sequence`'s `SequenceRenderer`. Promote to the dual-path
 * `createRenderingBackend` only once a profile shows Canvas2D can't keep 60fps
 * at the display's real feature counts (≳100K features/frame — see
 * RFC-001 §3a).
 */
export function createCanvas2DBackend<TRenderingBackend>(
  canvas: HTMLCanvasElement,
  createCanvas2DRenderingBackend: (
    canvas: HTMLCanvasElement,
  ) => TRenderingBackend,
): Promise<TRenderingBackend> {
  return Promise.resolve(createCanvas2DRenderingBackend(canvas))
}
