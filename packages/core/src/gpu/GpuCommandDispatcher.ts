/// <reference types="@webgpu/types" />
import type GpuHandlerType from '../pluggableElementTypes/GpuHandlerType.ts'
import type { GpuCanvasContext } from '../pluggableElementTypes/GpuHandlerType.ts'

export default class GpuCommandDispatcher {
  private device: GPUDevice | null = null
  private useWebGL = false
  private canvasMap = new Map<
    number,
    { handler: GpuHandlerType; ctx: GpuCanvasContext }
  >()
  private handlers: Map<string, GpuHandlerType>
  private devicePromise: Promise<boolean> | null = null

  constructor(handlers: GpuHandlerType[]) {
    this.handlers = new Map(handlers.map(h => [h.name, h]))
  }

  private async ensureDevice() {
    if (this.device) {
      return true
    }
    if (this.useWebGL) {
      return false
    }
    if (typeof navigator === 'undefined' || !navigator.gpu) {
      this.useWebGL = true
      for (const handler of this.handlers.values()) {
        handler.initWebGL?.()
      }
      return false
    }
    const adapter = await navigator.gpu.requestAdapter()
    if (!adapter) {
      this.useWebGL = true
      for (const handler of this.handlers.values()) {
        handler.initWebGL?.()
      }
      return false
    }
    this.device = await adapter.requestDevice({
      requiredLimits: {
        maxStorageBufferBindingSize:
          adapter.limits.maxStorageBufferBindingSize ?? 134217728,
        maxBufferSize: adapter.limits.maxBufferSize ?? 268435456,
      },
    })
    this.device.lost.then(info => {
      console.error('[GpuCommandDispatcher] Device lost:', info.message)
      this.device = null
    })
    for (const handler of this.handlers.values()) {
      handler.init(this.device)
    }
    return true
  }

  private async initCanvas(msg: {
    type: string
    canvasId: number
    handlerType: string
    canvas: OffscreenCanvas
  }) {
    const handler = this.handlers.get(msg.handlerType)
    if (!handler) {
      self.postMessage({
        type: 'init-result',
        canvasId: msg.canvasId,
        success: false,
        error: `Unknown GPU handler type: ${msg.handlerType}`,
      })
      return
    }

    if (!this.devicePromise) {
      this.devicePromise = this.ensureDevice()
    }
    const hasGpu = await this.devicePromise

    const canvas = msg.canvas
    const ctx: GpuCanvasContext = {
      canvas,
      device: hasGpu ? this.device ?? undefined : undefined,
      width: canvas.width,
      height: canvas.height,
    }

    this.canvasMap.set(msg.canvasId, { handler, ctx })

    self.postMessage({
      type: 'init-result',
      canvasId: msg.canvasId,
      success: true,
    })
  }

  private disposeCanvas(canvasId: number) {
    const entry = this.canvasMap.get(canvasId)
    if (entry) {
      entry.handler.dispose(canvasId)
      this.canvasMap.delete(canvasId)
    }
  }

  async handleMessage(msg: {
    type: string
    canvasId: number
    handlerType?: string
  }) {
    try {
      if (msg.type === 'init') {
        await this.initCanvas(
          msg as {
            type: string
            canvasId: number
            handlerType: string
            canvas: OffscreenCanvas
          },
        )
      } else if (msg.type === 'dispose') {
        this.disposeCanvas(msg.canvasId)
      } else {
        const entry = this.canvasMap.get(msg.canvasId)
        entry?.handler.handleMessage(
          msg as { type: string; canvasId: number; [key: string]: unknown },
          entry.ctx,
        )
      }
    } catch (e) {
      console.error('[GpuCommandDispatcher] Error handling message:', e)
    }
  }

  getDevice() {
    return this.device
  }
}
