/**
 * Shared out-of-memory / over-device-limit reporter for the GPU HALs. Both
 * WebGPU and WebGL2 detect an over-limit allocation (a buffer past
 * `maxBufferSize`, a texture past `maxTextureDimension2D`, or a frame that
 * exhausts VRAM), then need to log it AND forward it to the display's
 * renderError via the handler wired by `useRenderingBackend`. Centralized so
 * the two HALs can't drift.
 */
export class OomReporter {
  private handler: ((error: Error) => void) | null = null

  constructor(private hal: string) {}

  setHandler(handler: (error: Error) => void) {
    this.handler = handler
  }

  report(message: string) {
    console.error(`[${this.hal}] ${message}`)
    this.handler?.(new Error(message))
  }

  /**
   * Report an error the HAL has already classified, for a failure whose remedy
   * is not `report`'s "zoom in". Kept separate so the classification stays with
   * the caller that knows it — flagging every over-limit allocation as a context
   * loss would offer "Use Canvas2D" for a view that only needs zooming.
   */
  reportClassified(error: Error) {
    console.error(`[${this.hal}] ${error.message}`)
    this.handler?.(error)
  }
}
