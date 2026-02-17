/// <reference types="@webgpu/types" />
import PluggableElementBase from './PluggableElementBase.ts'

import type PluginManager from '../PluginManager.ts'

export interface GpuCanvasContext {
  canvas: OffscreenCanvas
  device?: GPUDevice
  width: number
  height: number
}

export default abstract class GpuHandlerType extends PluggableElementBase {
  pluginManager: PluginManager

  constructor(pluginManager: PluginManager) {
    super()
    this.pluginManager = pluginManager
  }

  abstract init(device: GPUDevice): void
  abstract initWebGL?(): void
  abstract handleMessage(
    msg: { type: string; canvasId: number; [key: string]: unknown },
    ctx: GpuCanvasContext,
  ): void
  abstract dispose(canvasId: number): void
}
