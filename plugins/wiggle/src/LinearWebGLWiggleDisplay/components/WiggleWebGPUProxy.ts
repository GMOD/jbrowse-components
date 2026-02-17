import type { WiggleRenderBlock } from './WebGLWiggleRenderer.ts'

let sharedWorker: Worker | null = null
let nextCanvasId = 0

function getSharedWorker() {
  if (!sharedWorker) {
    sharedWorker = new Worker(
      new URL('./wiggleGpuWorker.ts', import.meta.url),
      { type: 'module' },
    )
  }
  return sharedWorker
}

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
  private canvasId = nextCanvasId++
  private initPromise: Promise<boolean> | null = null

  static getOrCreate(canvas: HTMLCanvasElement) {
    let proxy = proxyCache.get(canvas)
    if (!proxy) {
      proxy = new WiggleWebGPUProxy()
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
            console.error('[WiggleWebGPU] Init failed:', e.data.error)
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

  resize(width: number, height: number) {
    sharedWorker?.postMessage({
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
    if (!sharedWorker) {
      return
    }
    const positions = new Uint32Array(data.featurePositions)
    const scores = new Float32Array(data.featureScores)
    sharedWorker.postMessage(
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
    sharedWorker?.postMessage({
      type: 'prune-regions',
      canvasId: this.canvasId,
      activeRegions,
    })
  }

  renderBlocks(blocks: WiggleRenderBlock[], renderState: WiggleGPURenderState) {
    sharedWorker?.postMessage({
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
    sharedWorker?.postMessage({
      type: 'render-single',
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
