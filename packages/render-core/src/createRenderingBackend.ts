import { assertUniquePassIds, createGpuHal } from './hal/index.ts'

import type { GpuHal, PipelineDescriptor, SampleCount } from './hal/types.ts'

/**
 * Options for `createRenderingBackend`. The two factories are an options object
 * (not positional args) on purpose: both are single-arg `(x) => new Backend(x)`
 * lambdas, so positionally they're trivially swappable by mistake — naming them
 * makes the GPU vs Canvas2D path unambiguous at every call site.
 */
export interface RenderingBackendOptions<TRenderingBackend> {
  passes: PipelineDescriptor[]
  uniformByteSize: number
  /**
   * Samples per pixel this display's WebGPU target is allocated at — 4 unless
   * stated, which is what every display asked for while this was a build-time
   * constant.
   *
   * **It is a property of the display, not of the build**, because what it buys
   * differs per display and what it costs does not. The cost is one colour
   * attachment the size of the canvas, so an empty 600px track pays what a full
   * one does and eight ordinary tracks on a retina panel hold 109.7 MiB nothing
   * counts (ARCHITECTURAL_LIMITS.md §"The MSAA target is the largest
   * per-display allocation"). What it buys is nothing at all for a display
   * whose fragments compute their own coverage, and the one fix there is for
   * conflation at the shared edges of tiled cells, which is Hi-C and LD.
   *
   * Setting it to 1 allocates **no** target rather than a smaller one. Which
   * displays should is a look-at-the-pixels decision taken one display at a
   * time; `ideas/arc-antialiasing-without-msaa.md` is the survey and the
   * captures.
   */
  sampleCount?: SampleCount
  createGpuBackend: (hal: GpuHal) => TRenderingBackend
  createCanvas2DBackend: (canvas: HTMLCanvasElement) => TRenderingBackend
}

export async function createRenderingBackend<TRenderingBackend>(
  canvas: HTMLCanvasElement,
  {
    passes,
    uniformByteSize,
    sampleCount = 4,
    createGpuBackend,
    createCanvas2DBackend,
  }: RenderingBackendOptions<TRenderingBackend>,
): Promise<TRenderingBackend> {
  // Before the ladder, so a duplicate id is reported on every machine rather
  // than only the ones that reach a GPU rung — the bug it prevents is silent
  // and GPU-only, which is precisely why a developer on the Canvas2D fallback
  // must not be the one who cannot see it.
  assertUniquePassIds(passes)
  // Each rung's reason is collected rather than dropped in the console: if
  // Canvas2D — the rung that cannot itself be fallen back from — also fails,
  // "Canvas 2D context not available" on its own says nothing about *why* the
  // two rungs above it declined, and those are usually the interesting part (a
  // committed context from a previous init, a driver that lost the device). The
  // error UI's stack-trace dialog walks `AggregateError.errors`, so bundling
  // them is what puts them in front of whoever reports the bug.
  const ladderFailures: unknown[] = []
  const hal = await createGpuHal(canvas, {
    passes,
    uniformByteSize,
    sampleCount,
    failures: ladderFailures,
  })
  if (hal) {
    return createGpuBackend(hal)
  }
  try {
    return createCanvas2DBackend(canvas)
  } catch (e) {
    if (ladderFailures.length === 0) {
      throw e
    }
    // `e` is the last entry of the errors array, which says more than `cause`
    // would: it places the Canvas2D failure in order behind the WebGPU and
    // WebGL ones.
    // oxlint-disable-next-line eslint/preserve-caught-error
    throw new AggregateError(
      [...ladderFailures, e],
      `No rendering backend could be created for this canvas: ${e}`,
    )
  }
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
