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
}
