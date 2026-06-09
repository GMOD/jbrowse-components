import { createGpuHal } from './hal/index.ts'

import type { GpuHal, PassDescriptor } from './hal/types.ts'

export async function createRenderingBackend<TRenderingBackend>(
  canvas: HTMLCanvasElement,
  passes: PassDescriptor[],
  uniformByteSize: number,
  createGpuRenderingBackend: (hal: GpuHal) => TRenderingBackend,
  createCanvas2DRenderingBackend: (
    canvas: HTMLCanvasElement,
  ) => TRenderingBackend,
): Promise<TRenderingBackend> {
  const hal = await createGpuHal(canvas, passes, uniformByteSize)
  return hal
    ? createGpuRenderingBackend(hal)
    : createCanvas2DRenderingBackend(canvas)
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
