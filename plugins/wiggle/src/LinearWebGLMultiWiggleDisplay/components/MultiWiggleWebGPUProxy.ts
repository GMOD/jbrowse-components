import type RpcManager from '@jbrowse/core/rpc/RpcManager'
import type { MultiWiggleRenderBlock, SourceRenderData } from './WebGLMultiWiggleRenderer.ts'

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
  private canvasId: number
  private initPromise: Promise<boolean> | null = null
  private workerPromise: Promise<Worker | undefined>
  private worker: Worker | undefined

  constructor(private rpcManager: RpcManager) {
    this.canvasId = rpcManager.getNextCanvasId()
    this.workerPromise = rpcManager.getGpuWorker().then(w => {
      this.worker = w
      return w
    })
  }

  static getOrCreate(canvas: HTMLCanvasElement, rpcManager: RpcManager) {
    let proxy = proxyCache.get(canvas)
    if (!proxy) {
      proxy = new MultiWiggleWebGPUProxy(rpcManager)
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
    const worker = await this.workerPromise
    if (!worker) {
      return false
    }

    return new Promise<boolean>(resolve => {
      const handler = (e: MessageEvent) => {
        if (
          e.data.type === 'init-result' &&
          e.data.canvasId === this.canvasId
        ) {
          worker.removeEventListener('message', handler)
          if (!e.data.success) {
            console.error('[MultiWiggleWorker] Init failed:', e.data.error)
          }
          resolve(e.data.success)
        }
      }
      worker.addEventListener('message', handler)
      worker.postMessage(
        {
          type: 'init',
          canvasId: this.canvasId,
          handlerType: 'WiggleGpuHandler',
          canvas: offscreen,
        },
        [offscreen],
      )
    })
  }

  uploadRegion(
    regionNumber: number,
    regionStart: number,
    sources: SourceRenderData[],
  ) {
    if (!this.worker) {
      return
    }

    let totalFeatures = 0
    for (const source of sources) {
      totalFeatures += source.numFeatures
    }

    if (totalFeatures === 0 || sources.length === 0) {
      this.worker.postMessage({
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

    this.worker.postMessage(
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
    this.worker?.postMessage({
      type: 'prune-regions',
      canvasId: this.canvasId,
      activeRegions,
    })
  }

  renderBlocks(
    blocks: MultiWiggleRenderBlock[],
    renderState: MultiWiggleGPURenderState,
  ) {
    this.worker?.postMessage({
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
    this.worker?.postMessage({
      type: 'render-multi-single',
      canvasId: this.canvasId,
      bpRangeX,
      renderState,
    })
  }

  dispose() {
    this.worker?.postMessage({
      type: 'dispose',
      canvasId: this.canvasId,
    })
    this.initPromise = null
  }
}
