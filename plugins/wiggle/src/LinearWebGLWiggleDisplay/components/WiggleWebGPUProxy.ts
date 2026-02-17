import type RpcManager from '@jbrowse/core/rpc/RpcManager'
import type { WiggleRenderBlock } from './WebGLWiggleRenderer.ts'

export interface WiggleGPURenderState {
  domainY: [number, number]
  scaleType: number
  renderingType: number
  useBicolor: number
  bicolorPivot: number
  color: [number, number, number]
  posColor: [number, number, number]
  negColor: [number, number, number]
  canvasWidth: number
  canvasHeight: number
}

const proxyCache = new WeakMap<HTMLCanvasElement, WiggleWebGPUProxy>()

export class WiggleWebGPUProxy {
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
      proxy = new WiggleWebGPUProxy(rpcManager)
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
            console.error('[WiggleWorker] Init failed:', e.data.error)
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

  resize(width: number, height: number) {
    this.worker?.postMessage({
      type: 'resize',
      canvasId: this.canvasId,
      width,
      height,
    })
  }

  uploadRegion(
    regionNumber: number,
    data: {
      regionStart: number
      featurePositions: Uint32Array
      featureScores: Float32Array
      numFeatures: number
    },
  ) {
    if (!this.worker) {
      return
    }
    const positions = new Uint32Array(data.featurePositions)
    const scores = new Float32Array(data.featureScores)
    this.worker.postMessage(
      {
        type: 'upload-region',
        canvasId: this.canvasId,
        regionNumber,
        regionStart: data.regionStart,
        featurePositions: positions,
        featureScores: scores,
        numFeatures: data.numFeatures,
      },
      [positions.buffer, scores.buffer],
    )
  }

  pruneRegions(activeRegions: number[]) {
    this.worker?.postMessage({
      type: 'prune-regions',
      canvasId: this.canvasId,
      activeRegions,
    })
  }

  renderBlocks(blocks: WiggleRenderBlock[], renderState: WiggleGPURenderState) {
    this.worker?.postMessage({
      type: 'render',
      canvasId: this.canvasId,
      blocks,
      renderState,
    })
  }

  renderSingle(
    bpRangeX: [number, number],
    renderState: WiggleGPURenderState,
  ) {
    this.worker?.postMessage({
      type: 'render-single',
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
