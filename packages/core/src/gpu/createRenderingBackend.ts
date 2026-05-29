import { createGpuHal } from './hal/index.ts'

import type { GpuHal, PassDescriptor } from './hal/types.ts'

export async function createRenderingBackend<TRenderingBackend>(
  canvas: HTMLCanvasElement,
  passes: PassDescriptor[],
  uniformByteSize: number,
  createGpuRenderingBackend: (hal: GpuHal) => TRenderingBackend,
  createCanvas2DRenderingBackend: (canvas: HTMLCanvasElement) => TRenderingBackend,
): Promise<TRenderingBackend> {
  const hal = await createGpuHal(canvas, passes, uniformByteSize)
  return hal ? createGpuRenderingBackend(hal) : createCanvas2DRenderingBackend(canvas)
}
