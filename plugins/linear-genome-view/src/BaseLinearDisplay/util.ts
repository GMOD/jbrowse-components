/**
 * Draws an ImageBitmap to a canvas element.
 * This is a shared utility for non-block-based displays that render
 * to a single canvas via RPC.
 *
 * @param canvas - The canvas element to draw to
 * @param imageData - The ImageBitmap to draw
 * @returns true if drawing was successful, false otherwise
 */
export function drawCanvasImageData(
  canvas: HTMLCanvasElement | null,
  imageData: ImageBitmap | undefined,
): boolean {
  if (!canvas || !imageData) {
    return false
  }

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return false
  }

  ctx.resetTransform()
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(imageData, 0, 0)
  return true
}
