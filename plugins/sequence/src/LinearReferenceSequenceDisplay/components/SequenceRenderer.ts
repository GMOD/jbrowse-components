import { initDualBackend } from '@jbrowse/core/gpu/createDualRenderer'

import { Canvas2DSequenceRenderer } from './Canvas2DSequenceRenderer.ts'
import { GpuSequenceRenderer, SEQUENCE_PASSES } from './GpuSequenceRenderer.ts'
import { UNIFORM_BYTE_SIZE } from './sequenceShaders.ts'

import type { SequenceBackend } from './sequenceBackendTypes.ts'

export async function createSequenceRenderer(
  canvas: HTMLCanvasElement,
): Promise<SequenceBackend> {
  return initDualBackend<SequenceBackend>(
    canvas,
    SEQUENCE_PASSES,
    UNIFORM_BYTE_SIZE,
    hal => new GpuSequenceRenderer(hal),
    c => new Canvas2DSequenceRenderer(c),
  )
}
