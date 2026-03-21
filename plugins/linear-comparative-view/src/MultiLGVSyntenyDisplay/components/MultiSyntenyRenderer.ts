import { getGpuOverride } from '@jbrowse/core/gpu/getGpuDevice'

import { Canvas2DMultiSyntenyRenderer } from './Canvas2DMultiSyntenyRenderer.ts'

import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'
import type {
  MultiSyntenyBackend,
  MultiSyntenyRenderOpts,
} from './multiSyntenyBackendTypes.ts'

const cache = new WeakMap<HTMLCanvasElement, MultiSyntenyRenderer>()

export class MultiSyntenyRenderer {
  private canvas: HTMLCanvasElement
  private backend: MultiSyntenyBackend | null = null

  private constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  static getOrCreate(canvas: HTMLCanvasElement) {
    let r = cache.get(canvas)
    if (!r) {
      r = new MultiSyntenyRenderer(canvas)
      cache.set(canvas, r)
    }
    return r
  }

  async init() {
    this.backend?.dispose()

    if (getGpuOverride() === 'canvas2d') {
      this.backend = new Canvas2DMultiSyntenyRenderer(this.canvas)
      return true
    }

    // For now, multi-synteny uses Canvas2D for all backends.
    // WebGL/WebGPU implementations can be added here following the
    // same pattern as SyntenyRenderer or AlignmentsRenderer.
    this.backend = new Canvas2DMultiSyntenyRenderer(this.canvas)
    return true
  }

  render(
    genomeRows: Map<string, MultiPairFeature[]>,
    displayedGenomes: string[],
    opts: MultiSyntenyRenderOpts,
  ) {
    this.backend?.render(genomeRows, displayedGenomes, opts)
  }

  dispose() {
    this.backend?.dispose()
    this.backend = null
    cache.delete(this.canvas)
  }
}
