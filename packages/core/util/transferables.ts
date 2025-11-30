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

function isArrayBufferLike(value: unknown): value is ArrayBufferLike {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as ArrayBufferLike).byteLength === 'number'
  )
}

/**
 * Collect transferable objects from a render result for zero-copy transfer.
 * Handles ImageBitmap, ArrayBuffer (flatbush), and other transferables.
 *
 * After transfer, ArrayBuffers become "detached" (byteLength = 0) in the sender.
 * This is expected behavior - the data has been moved, not copied.
 */
export function collectTransferables(
  result: Record<string, unknown>,
): Transferable[] {
  const transferables: Transferable[] = []
  const { imageData, flatbush, subfeatureFlatbush } = result

  if (isImageBitmap(imageData)) {
    transferables.push(imageData)
  }
  if (isArrayBufferLike(flatbush)) {
    if (isDetachedBuffer(flatbush)) {
      console.warn('flatbush buffer is already detached, cannot transfer')
    } else {
      transferables.push(flatbush)
    }
  }
  if (isArrayBufferLike(subfeatureFlatbush)) {
    if (isDetachedBuffer(subfeatureFlatbush)) {
      console.warn(
        'subfeatureFlatbush buffer is already detached, cannot transfer',
      )
    } else {
      transferables.push(subfeatureFlatbush)
    }
  }
  return transferables
}
