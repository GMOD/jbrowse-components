import type { SyntenyInstanceData } from '../LinearSyntenyRPC/executeSyntenyInstanceData.ts'

const proxyCache = new WeakMap<HTMLCanvasElement, SyntenyWebGPUProxy>()

export class SyntenyWebGPUProxy {
  private worker: Worker | null = null
  private initialized = false
  private initPromise: Promise<boolean> | null = null
  private cachedPickResult = -1
  private pendingPick = false

  static getOrCreate(canvas: HTMLCanvasElement) {
    let proxy = proxyCache.get(canvas)
    if (!proxy) {
      proxy = new SyntenyWebGPUProxy()
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
    this.worker = new Worker(
      new URL('./syntenyGpuWorker.ts', import.meta.url),
      { type: 'module' },
    )

    return new Promise<boolean>(resolve => {
      this.worker!.onmessage = (e: MessageEvent) => {
        const msg = e.data
        if (msg.type === 'init-result') {
          this.initialized = msg.success
          if (!msg.success) {
            console.error('[WebGPU Proxy] Init failed:', msg.error)
          }
          resolve(msg.success)
        } else if (msg.type === 'pick-result') {
          this.cachedPickResult = msg.featureIndex
          this.pendingPick = false
        }
      }

      this.worker!.postMessage({ type: 'init', canvas: offscreen }, [offscreen])
    })
  }

  resize(width: number, height: number, dpr = 2) {
    this.worker?.postMessage({ type: 'resize', width, height, dpr })
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

    this.worker.postMessage({
      type: 'upload-geometry',
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
    }, transferables)
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
  ) {
    this.worker?.postMessage({
      type: 'render',
      offset0,
      offset1,
      height,
      curBpPerPx0,
      curBpPerPx1,
      maxOffScreenPx,
      minAlignmentLength,
      alpha,
    })
  }

  pick(x: number, y: number) {
    if (!this.pendingPick) {
      this.pendingPick = true
      this.worker?.postMessage({ type: 'pick', x, y })
    }
    return this.cachedPickResult
  }

  dispose() {
    this.worker?.postMessage({ type: 'dispose' })
    this.worker?.terminate()
    this.worker = null
    this.initialized = false
  }
}
