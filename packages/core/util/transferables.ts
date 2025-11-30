/**
 * Check if an ArrayBuffer has been transferred (detached).
 * Useful for debugging to verify transfers are working.
 */
export function isDetachedBuffer(buffer: ArrayBufferLike): boolean {
  return buffer.byteLength === 0
}

/**
 * Safely check if a value is an ImageBitmap.
 * Works in both browser and Node.js environments.
 * (Duplicated here to avoid circular dependency with offscreenCanvasPonyfill)
 */
function isImageBitmap(value: unknown): value is ImageBitmap {
  return typeof ImageBitmap !== 'undefined' && value instanceof ImageBitmap
}

/**
 * Collect transferable objects from a render result for zero-copy transfer.
 * Handles ImageBitmap, ArrayBuffer (flatbush), and other transferables.
 *
 * After transfer, ArrayBuffers become "detached" (byteLength = 0) in the sender.
 * This is expected behavior - the data has been moved, not copied.
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
    if (isDetachedBuffer(result.flatbush)) {
      console.warn('flatbush buffer is already detached, cannot transfer')
    } else {
      transferables.push(result.flatbush)
    }
  }
  if (result.subfeatureFlatbush) {
    if (isDetachedBuffer(result.subfeatureFlatbush)) {
      console.warn('subfeatureFlatbush buffer is already detached, cannot transfer')
    } else {
      transferables.push(result.subfeatureFlatbush)
    }
  }
  return transferables
}
