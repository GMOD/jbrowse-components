import type RpcManager from '@jbrowse/core/rpc/RpcManager'

const proxyCache = new WeakMap<HTMLCanvasElement, DotplotWebGPUProxy>()

export class DotplotWebGPUProxy {
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
      proxy = new DotplotWebGPUProxy(rpcManager)
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
        const msg = e.data
        if (msg.type === 'init-result' && msg.canvasId === this.canvasId) {
          worker.removeEventListener('message', handler)
          if (!msg.success) {
            console.error('[DotplotWebGPU Proxy] Init failed:', msg.error)
          }
          resolve(msg.success)
        }
      }
      worker.addEventListener('message', handler)
      worker.postMessage(
        {
          type: 'init',
          canvasId: this.canvasId,
          handlerType: 'DotplotGpuHandler',
          canvas: offscreen,
        },
        [offscreen],
      )
    })
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

  uploadGeometry(data: {
    x1s: Float32Array
    y1s: Float32Array
    x2s: Float32Array
    y2s: Float32Array
    colors: Float32Array
    instanceCount: number
  }) {
    if (!this.worker) {
      return
    }

    const transferables = [
      data.x1s.buffer,
      data.y1s.buffer,
      data.x2s.buffer,
      data.y2s.buffer,
      data.colors.buffer,
    ].filter((b, i, arr) => arr.indexOf(b) === i) as Transferable[]

    this.worker.postMessage(
      {
        type: 'upload-geometry',
        canvasId: this.canvasId,
        x1s: data.x1s,
        y1s: data.y1s,
        x2s: data.x2s,
        y2s: data.y2s,
        colors: data.colors,
        instanceCount: data.instanceCount,
      },
      transferables,
    )
  }

  render(
    offsetX: number,
    offsetY: number,
    lineWidth: number,
    scaleX: number,
    scaleY: number,
  ) {
    this.worker?.postMessage({
      type: 'render',
      canvasId: this.canvasId,
      offsetX,
      offsetY,
      lineWidth,
      scaleX,
      scaleY,
    })
  }

  dispose() {
    this.worker?.postMessage({
      type: 'dispose',
      canvasId: this.canvasId,
    })
  }
}
