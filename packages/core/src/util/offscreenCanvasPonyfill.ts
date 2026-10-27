import { CanvasSequence } from 'canvas-sequencer-ts'

/** The canvas-sequencer command list a worker without OffscreenCanvas sends. */
export interface SerializedCanvasCommands {
  serializedCommands: NonNullable<
    ConstructorParameters<typeof CanvasSequence>[0]
  >
}

/** What a worker hands the main thread to paint. */
export type WorkerImageData = CanvasImageSource | SerializedCanvasCommands

function isSerializedCanvasCommands(
  imageData: WorkerImageData,
): imageData is SerializedCanvasCommands {
  return 'serializedCommands' in imageData
}

/**
 * Paint a worker-produced image onto a 2d context: either a real
 * ImageBitmap/canvas, or the serialized canvas-sequencer command list a worker
 * without OffscreenCanvas sends instead.
 */
export function drawImageOntoCanvasContext(
  imageData: WorkerImageData,
  context: CanvasRenderingContext2D,
) {
  if (isSerializedCanvasCommands(imageData)) {
    new CanvasSequence(imageData.serializedCommands).execute(context)
  } else {
    context.drawImage(imageData, 0, 0)
  }
}
