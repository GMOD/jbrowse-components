import type { MultiWiggleRenderBlock, SourceRenderData } from './WebGLMultiWiggleRenderer.ts'

let sharedWorker: Worker | null = null
let nextCanvasId = 0

function getSharedWorker() {
  if (!sharedWorker) {
    sharedWorker = new Worker(
      new URL(
        '../../LinearWebGLWiggleDisplay/components/wiggleGpuWorker.ts',
        import.meta.url,
      ),
      { type: 'module' },
    )
  }
  return sharedWorker
}

export interface MultiWiggleGPURenderState {
  domainY: [number, number]
  scaleType: number
  renderingType: number
  rowPadding: number
  canvasWidth: number
  canvasHeight: number
}

const proxyCache = new WeakMap<HTMLCanvasElement, MultiWiggleWebGPUProxy>()

export class MultiWiggleWebGPUProxy {
  private canvasId = nextCanvasId++
  private initPromise: Promise<boolean> | null = null

  static getOrCreate(canvas: HTMLCanvasElement) {
    let proxy = proxyCache.get(canvas)
    if (!proxy) {
      proxy = new MultiWiggleWebGPUProxy()
      proxyCache.set(canvas, proxy)
    }
    return proxy
  }

  async init(canvas: HTMLCanvasElement) {
    if (this.initPromise) {
      return this.initPromise
    }
    this.initPromise = this._doInit(canvas)
    return this.initPromise
  }

  private async _doInit(canvas: HTMLCanvasElement) {
    const offscreen = canvas.transferControlToOffscreen()
    const worker = getSharedWorker()

    return new Promise<boolean>(resolve => {
      const handler = (e: MessageEvent) => {
        if (
          e.data.type === 'init-result' &&
          e.data.canvasId === this.canvasId
        ) {
          worker.removeEventListener('message', handler)
          if (!e.data.success) {
            console.error('[MultiWiggleWebGPU] Init failed:', e.data.error)
          }
          resolve(e.data.success)
        }
      }
      worker.addEventListener('message', handler)
      worker.postMessage(
        { type: 'init', canvasId: this.canvasId, canvas: offscreen },
        [offscreen],
      )
    })
  }

  uploadRegion(
    regionNumber: number,
    regionStart: number,
    sources: SourceRenderData[],
  ) {
    if (!sharedWorker) {
      return
    }

    let totalFeatures = 0
    for (const source of sources) {
      totalFeatures += source.numFeatures
    }

    if (totalFeatures === 0 || sources.length === 0) {
      sharedWorker.postMessage({
        type: 'upload-multi-region',
        canvasId: this.canvasId,
        regionNumber,
        regionStart,
        totalFeatures: 0,
        numRows: 0,
      })
      return
    }

    const positions = new Uint32Array(totalFeatures * 2)
    const scores = new Float32Array(totalFeatures)
    const prevScores = new Float32Array(totalFeatures)
    const rowIndices = new Float32Array(totalFeatures)
    const colors = new Float32Array(totalFeatures * 3)

    let offset = 0
    for (const [rowIndex, source] of sources.entries()) {
      for (let i = 0; i < source.numFeatures; i++) {
        positions[(offset + i) * 2] = source.featurePositions[i * 2]!
        positions[(offset + i) * 2 + 1] = source.featurePositions[i * 2 + 1]!
        scores[offset + i] = source.featureScores[i]!
        prevScores[offset + i] =
          i === 0 ? source.featureScores[i]! : source.featureScores[i - 1]!
        rowIndices[offset + i] = rowIndex
        colors[(offset + i) * 3] = source.color[0]
        colors[(offset + i) * 3 + 1] = source.color[1]
        colors[(offset + i) * 3 + 2] = source.color[2]
      }
      offset += source.numFeatures
    }

    sharedWorker.postMessage(
      {
        type: 'upload-multi-region',
        canvasId: this.canvasId,
        regionNumber,
        regionStart,
        totalFeatures,
        numRows: sources.length,
        positions,
        scores,
        prevScores,
        rowIndices,
        colors,
      },
      [
        positions.buffer,
        scores.buffer,
        prevScores.buffer,
        rowIndices.buffer,
        colors.buffer,
      ],
    )
  }

  pruneRegions(activeRegions: number[]) {
    sharedWorker?.postMessage({
      type: 'prune-regions',
      canvasId: this.canvasId,
      activeRegions,
    })
  }

  renderBlocks(
    blocks: MultiWiggleRenderBlock[],
    renderState: MultiWiggleGPURenderState,
  ) {
    sharedWorker?.postMessage({
      type: 'render-multi',
      canvasId: this.canvasId,
      blocks,
      renderState,
    })
  }

  renderSingle(
    bpRangeX: [number, number],
    renderState: MultiWiggleGPURenderState,
  ) {
    sharedWorker?.postMessage({
      type: 'render-multi-single',
      canvasId: this.canvasId,
      bpRangeX,
      renderState,
    })
  }

  dispose() {
    sharedWorker?.postMessage({
      type: 'dispose',
      canvasId: this.canvasId,
    })
    this.initPromise = null
  }
}
