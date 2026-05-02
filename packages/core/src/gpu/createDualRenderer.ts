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
  console.warn(
    '[initDualBackend] hal:',
    !!hal,
    'canvas size:',
    canvas.width,
    'x',
    canvas.height,
  )
  if (hal) {
    console.warn('[initDualBackend] Using GPU backend')
    return createGpuBackend(hal)
  } else {
    console.warn('[initDualBackend] Falling back to Canvas2D backend')
    return createCanvas2DBackend(canvas)
  }
}
