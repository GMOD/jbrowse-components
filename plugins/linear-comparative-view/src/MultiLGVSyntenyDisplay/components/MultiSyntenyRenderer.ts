import { getGpuOverride } from '@jbrowse/core/gpu/getGpuDevice'

import { Canvas2DMultiSyntenyRenderer } from './Canvas2DMultiSyntenyRenderer.ts'
import { prepareMultiSyntenyGpuData } from './multiSyntenyGpuData.ts'

import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'
import type {
  MultiSyntenyCanvasBackend,
  MultiSyntenyCanvasRenderOpts,
  MultiSyntenyGpuBackend,
} from './multiSyntenyBackendTypes.ts'
import type { BaseBlock } from '@jbrowse/core/util/blockTypes'

const cache = new WeakMap<HTMLCanvasElement, MultiSyntenyRenderer>()

export class MultiSyntenyRenderer {
  private canvas: HTMLCanvasElement
  private gpuBackend: MultiSyntenyGpuBackend | null = null
  private canvasBackend: MultiSyntenyCanvasBackend | null = null
  private backendType: 'webgpu' | 'webgl' | 'canvas2d' = 'canvas2d'

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
    this.gpuBackend?.dispose()
    this.canvasBackend?.dispose()
    this.gpuBackend = null
    this.canvasBackend = null

    if (getGpuOverride() === 'canvas2d') {
      console.log('[MultiSyntenyRenderer] Using Canvas2D (forced)')
      this.canvasBackend = new Canvas2DMultiSyntenyRenderer(this.canvas)
      this.backendType = 'canvas2d'
      return true
    }

    // Try WebGPU first
    try {
      const { WebGPUMultiSyntenyRenderer } = await import(
        './WebGPUMultiSyntenyRenderer.ts'
      )
      const gpu = await WebGPUMultiSyntenyRenderer.create(this.canvas)
      if (gpu) {
        console.log('[MultiSyntenyRenderer] Using WebGPU backend')
        this.gpuBackend = gpu
        this.backendType = 'webgpu'
        return true
      }
      console.log('[MultiSyntenyRenderer] WebGPU create returned null')
    } catch (e) {
      console.log('[MultiSyntenyRenderer] WebGPU not available:', e)
    }

    // Try WebGL2
    try {
      const { WebGLMultiSyntenyRenderer } = await import(
        './WebGLMultiSyntenyRenderer.ts'
      )
      this.gpuBackend = new WebGLMultiSyntenyRenderer(this.canvas)
      console.log('[MultiSyntenyRenderer] Using WebGL2 backend')
      this.backendType = 'webgl'
      return true
    } catch (e) {
      console.log('[MultiSyntenyRenderer] WebGL2 not available:', e)
    }

    // Fall back to Canvas2D
    console.log('[MultiSyntenyRenderer] Falling back to Canvas2D')
    this.canvasBackend = new Canvas2DMultiSyntenyRenderer(this.canvas)
    this.backendType = 'canvas2d'
    return true
  }

  get isGpu() {
    return this.gpuBackend !== null
  }

  uploadGeometry(
    genomeRows: Map<string, MultiPairFeature[]>,
    displayedGenomes: string[],
    colorBy: string,
    showSnps: boolean,
  ) {
    if (this.gpuBackend) {
      console.log(
        '[MultiSyntenyRenderer] uploadGeometry:',
        'genomeRows:', genomeRows.size,
        'displayedGenomes:', displayedGenomes.length,
        'colorBy:', colorBy,
        'showSnps:', showSnps,
      )
      const data = prepareMultiSyntenyGpuData(
        genomeRows,
        displayedGenomes,
        colorBy,
        showSnps,
      )
      console.log(
        '[MultiSyntenyRenderer] GPU data prepared:',
        'instanceCount:', data.instanceCount,
        'bufferBytes:', data.buffer.byteLength,
        'refNameIndex:', [...data.refNameIndex.entries()],
      )
      this.gpuBackend.uploadGeometry(data)
    }
  }

  renderGpu(
    contentBlocks: BaseBlock[],
    viewOffsetPx: number,
    width: number,
    height: number,
    rowHeight: number,
    labelW: number,
  ) {
    console.log(
      '[MultiSyntenyRenderer] renderGpu:',
      'blocks:', contentBlocks.length,
      'blockRefNames:', contentBlocks.map(b => `${b.refName}:${b.start}-${b.end}`),
      'width:', width,
      'height:', height,
      'rowHeight:', rowHeight,
      'labelW:', labelW,
    )
    this.gpuBackend?.render(
      contentBlocks,
      viewOffsetPx,
      width,
      height,
      rowHeight,
      labelW,
    )
  }

  renderCanvas(
    genomeRows: Map<string, MultiPairFeature[]>,
    displayedGenomes: string[],
    opts: MultiSyntenyCanvasRenderOpts,
  ) {
    console.log(
      '[MultiSyntenyRenderer] renderCanvas:',
      'genomeRows:', genomeRows.size,
      'displayedGenomes:', displayedGenomes.length,
      'width:', opts.width,
      'height:', opts.height,
      'rowHeight:', opts.rowHeight,
    )
    this.canvasBackend?.render(genomeRows, displayedGenomes, opts)
  }

  dispose() {
    this.gpuBackend?.dispose()
    this.canvasBackend?.dispose()
    this.gpuBackend = null
    this.canvasBackend = null
    cache.delete(this.canvas)
  }
}
