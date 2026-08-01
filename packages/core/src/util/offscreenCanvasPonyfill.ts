import { CanvasSequence } from 'canvas-sequencer-ts'

/**
 * Paint a worker-produced image onto a 2d context: either a real
 * ImageBitmap/canvas, or the serialized canvas-sequencer command list a worker
 * without OffscreenCanvas sends instead.
 */
export function drawImageOntoCanvasContext(
  imageData: any,
  context: CanvasRenderingContext2D,
) {
  if (imageData.serializedCommands) {
    const seq = new CanvasSequence(imageData.serializedCommands)
    seq.execute(context)
  } else {
    context.drawImage(imageData as CanvasImageSource, 0, 0)
  }
}
