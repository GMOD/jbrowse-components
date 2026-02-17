import type RpcManager from '@jbrowse/core/rpc/RpcManager'

export interface FeatureRenderBlock {
  regionNumber: number
  bpRangeX: [number, number]
  screenStartPx: number
  screenEndPx: number
}

const proxyCache = new WeakMap<HTMLCanvasElement, CanvasFeatureProxy>()

export class CanvasFeatureProxy {
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
      proxy = new CanvasFeatureProxy(rpcManager)
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
            console.error('[CanvasFeatureWorker] Init failed:', e.data.error)
          }
          resolve(e.data.success)
        }
      }
      worker.addEventListener('message', handler)
      worker.postMessage(
        {
          type: 'init',
          canvasId: this.canvasId,
          handlerType: 'CanvasFeatureGpuHandler',
          canvas: offscreen,
        },
        [offscreen],
      )
    })
  }

  uploadForRegion(
    regionNumber: number,
    data: {
      regionStart: number
      rectPositions: Uint32Array
      rectYs: Float32Array
      rectHeights: Float32Array
      rectColors: Uint8Array
      numRects: number
      linePositions: Uint32Array
      lineYs: Float32Array
      lineColors: Uint8Array
      lineDirections: Int8Array
      numLines: number
      arrowXs: Uint32Array
      arrowYs: Float32Array
      arrowDirections: Int8Array
      arrowHeights: Float32Array
      arrowColors: Uint8Array
      numArrows: number
    },
  ) {
    this.worker?.postMessage({
      type: 'upload-region',
      canvasId: this.canvasId,
      regionNumber,
      regionStart: data.regionStart,
      rectPositions: data.rectPositions,
      rectYs: data.rectYs,
      rectHeights: data.rectHeights,
      rectColors: data.rectColors,
      numRects: data.numRects,
      linePositions: data.linePositions,
      lineYs: data.lineYs,
      lineColors: data.lineColors,
      lineDirections: data.lineDirections,
      numLines: data.numLines,
      arrowXs: data.arrowXs,
      arrowYs: data.arrowYs,
      arrowDirections: data.arrowDirections,
      arrowHeights: data.arrowHeights,
      arrowColors: data.arrowColors,
      numArrows: data.numArrows,
    })
  }

  renderBlocks(
    blocks: FeatureRenderBlock[],
    state: { scrollY: number; canvasWidth: number; canvasHeight: number },
  ) {
    this.worker?.postMessage({
      type: 'render-blocks',
      canvasId: this.canvasId,
      blocks,
      scrollY: state.scrollY,
      canvasWidth: state.canvasWidth,
      canvasHeight: state.canvasHeight,
    })
  }

  pruneStaleRegions(activeRegions: number[]) {
    this.worker?.postMessage({
      type: 'prune-regions',
      canvasId: this.canvasId,
      activeRegions,
    })
  }

  dispose() {
    this.worker?.postMessage({
      type: 'dispose',
      canvasId: this.canvasId,
    })
  }
}
