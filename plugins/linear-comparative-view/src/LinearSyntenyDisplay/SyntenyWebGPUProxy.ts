import type RpcManager from '@jbrowse/core/rpc/RpcManager'
import type { SyntenyInstanceData } from '../LinearSyntenyRPC/executeSyntenyInstanceData.ts'

const proxyCache = new WeakMap<HTMLCanvasElement, SyntenyWebGPUProxy>()

export class SyntenyWebGPUProxy {
  private canvasId: number
  private initPromise: Promise<boolean> | null = null
  private workerPromise: Promise<Worker | undefined>
  private worker: Worker | undefined
  private cachedPickResult = -1
  private pendingPick = false
  private pickListener: ((e: MessageEvent) => void) | null = null

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
      proxy = new SyntenyWebGPUProxy(rpcManager)
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

    this.setupPickListener(worker)

    return new Promise<boolean>(resolve => {
      const handler = (e: MessageEvent) => {
        const msg = e.data
        if (msg.type === 'init-result' && msg.canvasId === this.canvasId) {
          worker.removeEventListener('message', handler)
          if (!msg.success) {
            console.error('[WebGPU Proxy] Init failed:', msg.error)
          }
          resolve(msg.success)
        }
      }
      worker.addEventListener('message', handler)
      worker.postMessage(
        {
          type: 'init',
          canvasId: this.canvasId,
          handlerType: 'SyntenyGpuHandler',
          canvas: offscreen,
        },
        [offscreen],
      )
    })
  }

  private setupPickListener(worker: Worker) {
    this.pickListener = (e: MessageEvent) => {
      const msg = e.data
      if (msg.type === 'pick-result' && msg.canvasId === this.canvasId) {
        this.cachedPickResult = msg.featureIndex
        this.pendingPick = false
      }
    }
    worker.addEventListener('message', this.pickListener)
  }

  resize(width: number, height: number, dpr = 2) {
    this.worker?.postMessage({
      type: 'resize',
      canvasId: this.canvasId,
      width,
      height,
      dpr,
    })
  }

  uploadGeometry(data: SyntenyInstanceData) {
    if (!this.worker) {
      return
    }

    const transferables = [
      data.x1.buffer,
      data.x2.buffer,
      data.x3.buffer,
      data.x4.buffer,
      data.colors.buffer,
      data.featureIds.buffer,
      data.isCurves.buffer,
      data.queryTotalLengths.buffer,
      data.padTops.buffer,
      data.padBottoms.buffer,
    ].filter((b, i, arr) => arr.indexOf(b) === i) as Transferable[]

    this.worker.postMessage(
      {
        type: 'upload-geometry',
        canvasId: this.canvasId,
        x1: data.x1,
        x2: data.x2,
        x3: data.x3,
        x4: data.x4,
        colors: data.colors,
        featureIds: data.featureIds,
        isCurves: data.isCurves,
        queryTotalLengths: data.queryTotalLengths,
        padTops: data.padTops,
        padBottoms: data.padBottoms,
        instanceCount: data.instanceCount,
        nonCigarInstanceCount: data.nonCigarInstanceCount,
        geometryBpPerPx0: data.geometryBpPerPx0,
        geometryBpPerPx1: data.geometryBpPerPx1,
        refOffset0: data.refOffset0,
        refOffset1: data.refOffset1,
      },
      transferables,
    )
  }

  render(
    offset0: number,
    offset1: number,
    height: number,
    curBpPerPx0: number,
    curBpPerPx1: number,
    maxOffScreenPx: number,
    minAlignmentLength: number,
    alpha: number,
    hoveredFeatureId: number,
    clickedFeatureId: number,
  ) {
    this.worker?.postMessage({
      type: 'render',
      canvasId: this.canvasId,
      offset0,
      offset1,
      height,
      curBpPerPx0,
      curBpPerPx1,
      maxOffScreenPx,
      minAlignmentLength,
      alpha,
      hoveredFeatureId,
      clickedFeatureId,
    })
  }

  pick(x: number, y: number) {
    if (!this.pendingPick) {
      this.pendingPick = true
      this.worker?.postMessage({
        type: 'pick',
        canvasId: this.canvasId,
        x,
        y,
      })
    }
    return this.cachedPickResult
  }

  dispose() {
    if (this.pickListener && this.worker) {
      this.worker.removeEventListener('message', this.pickListener)
      this.pickListener = null
    }
    this.worker?.postMessage({
      type: 'dispose',
      canvasId: this.canvasId,
    })
    this.initPromise = null
  }
}
