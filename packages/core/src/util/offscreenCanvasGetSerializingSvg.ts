import { CanvasSequence } from 'canvas-sequencer-ts'

import { SvgCanvas } from './SvgCanvas.ts'

export function getSerializedSvg(results: {
  width: number
  height: number
  canvasRecordedData: unknown
}) {
  const { canvasRecordedData } = results
  const ctx = new SvgCanvas()
  const seq = new CanvasSequence(canvasRecordedData as any)
  seq.execute(ctx)
  return ctx.getSerializedSvg()
}
