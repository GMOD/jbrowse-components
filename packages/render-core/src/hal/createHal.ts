import {
  getGpuOverride,
  isGpuRenderingDisabled,
  setBuiltRenderer,
} from '../gpuDevice.ts'
import { getGraphicsCapabilities } from '../graphicsCapabilities.ts'
import { WebGL2Hal } from './webgl2Hal.ts'
import { WebGPUHal } from './webgpuHal.ts'

import type { GpuHal, PipelineDescriptor, SampleCount } from './types.ts'

// Per copy of this module rather than on the globalThis cell, deliberately: a
// second bundled copy warning a second time is a duplicate console line, which
// is the "a memo per copy is fine" case ADR-030's amendment carves out. Nothing
// reads it.
let warnedSoftwareRasterizer = false

function warnSoftwareRasterizerOnce(glRenderer: string | undefined) {
  if (warnedSoftwareRasterizer) {
    return
  }
  warnedSoftwareRasterizer = true
  console.warn(
    `[GPU] WebGL2 here is software-rendered (${glRenderer ?? 'unknown driver'}), where it costs several times Canvas2D on the main thread — rendering with Canvas2D instead. Pass ?renderer=webgl to use WebGL2 anyway.`,
  )
}

export interface GpuHalOptions {
  passes: PipelineDescriptor[]
  uniformByteSize: number
  /**
   * Reaches the WebGPU rung only. The WebGL2 rung draws to the default
   * framebuffer with `antialias: true`, so its multisampling is the browser's
   * own and there is nothing here to thread into it.
   */
  sampleCount: SampleCount
  /**
   * Out-parameter collecting why each rung declined, in ladder order. Falling
   * through a rung is normal (no WebGPU on this machine) and stays a
   * `console.warn` — but when the *last* rung fails too, the reasons the earlier
   * ones gave are the diagnosis, and they used to exist only in a console the
   * user reporting the bug never opens. `createRenderingBackend` attaches this
   * to the error it throws, and the error UI's stack-trace dialog already walks
   * `AggregateError.errors` (core's `formatErrorStack`), so they arrive with it.
   */
  failures?: unknown[]
}

// Ladder: WebGPU → WebGL2 → Canvas2D (null). The `?renderer=` URL param pins it
// to a single rung for debugging — `webgpu`, `webgl`, or `canvas2d`/`canvas` —
// and a pin never falls through to the next rung. See GPU_OVERRIDES.
//
// Records the rung it returned on the page-wide cell, which is how
// `effectiveRenderer` gets to report what drew rather than what the adapter
// probe predicted — the two part when `WebGPUHal.create` throws and the ladder
// lands on WebGL2.
export async function createGpuHal(
  canvas: HTMLCanvasElement,
  options: GpuHalOptions,
): Promise<GpuHal | null> {
  const hal = await climbLadder(canvas, options)
  setBuiltRenderer(
    hal === null ? 'Canvas2D' : hal instanceof WebGPUHal ? 'WebGPU' : 'WebGL2',
  )
  return hal
}

async function climbLadder(
  canvas: HTMLCanvasElement,
  { passes, uniformByteSize, sampleCount, failures }: GpuHalOptions,
): Promise<GpuHal | null> {
  if (isGpuRenderingDisabled()) {
    return null
  }
  const override = getGpuOverride()
  if (override !== 'webgl') {
    try {
      const webgpu = await WebGPUHal.create(
        canvas,
        passes,
        uniformByteSize,
        sampleCount,
      )
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
  // The one machine where the WebGL2 rung is the wrong answer even though it
  // works: a software rasterizer. Measured on one ordinary view — 1 view, 3
  // volvox tracks, and *no scroll churn at all* — headless Chrome (SwiftShader),
  // three runs each: WebGL2 blocks the main thread for 1.3-5.5 s in a single
  // task and 2.1-8.8 s in total, while Canvas2D never exceeds 339 ms and never
  // once produces a task over 500 ms. GPU_CONTEXT_BUDGET.md has the churn case
  // at ~25x; this is the floor, and it is the load-time pipeline build rather
  // than the per-pass rebuild the churn number measures.
  //
  // Stepping over the rung rather than pinning the page is the difference that
  // matters: `gpuOverride` means "a human asked for this", and spending it on a
  // decision the app made would leave nothing able to tell the two apart —
  // including the About widget and the bug report the user is about to send.
  //
  // Only when nothing was pinned. `?renderer=webgl` means that rung, and the
  // browser-test runner sets it for every GPU arm (`appendGpuParam`), so the
  // cross-backend gate keeps comparing canvas2d against a real WebGL2 render
  // rather than against a second Canvas2D one — it runs under SwiftShader, so
  // without that pin this check would quietly make it compare a backend with
  // itself and pass.
  //
  // `softwareWebgl` is `undefined` wherever the browser withholds
  // WEBGL_debug_renderer_info (Firefox under privacy.resistFingerprinting), and
  // that must not read as `true`: an unknown rasterizer keeps the WebGL2 rung.
  if (override === null) {
    const { softwareWebgl, glRenderer } = await getGraphicsCapabilities()
    if (softwareWebgl) {
      warnSoftwareRasterizerOnce(glRenderer)
      return null
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
