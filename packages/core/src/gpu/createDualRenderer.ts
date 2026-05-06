import { createGpuHal } from './hal/index.ts'

import type { GpuHal, PassDescriptor } from './hal/types.ts'

export async function initDualBackend<TBackend>(
  canvas: HTMLCanvasElement,
  passes: PassDescriptor[],
  uniformByteSize: number,
  createGpuBackend: (hal: GpuHal) => TBackend,
  createCanvas2DBackend: (canvas: HTMLCanvasElement) => TBackend,
): Promise<TBackend> {
  const hal = await createGpuHal(canvas, passes, uniformByteSize)
  return hal ? createGpuBackend(hal) : createCanvas2DBackend(canvas)
}
