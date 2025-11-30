import { isImageBitmap } from './offscreenCanvasPonyfill'

/**
 * Collect transferable objects from a render result for zero-copy transfer.
 * Handles ImageBitmap, ArrayBuffer (flatbush), and other transferables.
 */
export function collectTransferables(result: {
  imageData?: unknown
  flatbush?: ArrayBufferLike
  subfeatureFlatbush?: ArrayBufferLike
}): Transferable[] {
  const transferables: Transferable[] = []
  if (isImageBitmap(result.imageData)) {
    transferables.push(result.imageData)
  }
  if (result.flatbush) {
    transferables.push(result.flatbush)
  }
  if (result.subfeatureFlatbush) {
    transferables.push(result.subfeatureFlatbush)
  }
  return transferables
}
