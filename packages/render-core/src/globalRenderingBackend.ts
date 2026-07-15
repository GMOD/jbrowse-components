import {
  Canvas2DRenderingBackendBase,
  GpuRenderingBackendBase,
} from './renderingBackendBase.ts'

/**
 * Shared contract for monolithic GPU backends (HiC, LD, multi-variant
 * matrix) — displays with no region partitioning. One bulk upload, one
 * draw per frame. Render receives the data directly so Canvas2D backends
 * stay stateless; GPU backends use `uploadData` to push bytes into a HAL
 * buffer and ignore the `data` arg at render time.
 *
 * Plugins with color textures or other side-channel resources (HiC, LD)
 * extend this interface with their own upload methods (e.g.
 * `uploadColorRamp`); the base contract stays minimal.
 */
export interface GlobalRenderingBackend<UploadData, RenderState> {
  uploadData(data: UploadData): void
  render(data: UploadData | null, state: RenderState): void
  dispose(): void
}

/**
 * Canvas2D-side base for `GlobalRenderingBackend` implementations. Inherits the
 * `canvas` + 2D context (and no-op `dispose`) from
 * `Canvas2DRenderingBackendBase`; stubs `uploadData` (no-op — data flows through
 * `render`). Subclasses implement `render` and nothing else.
 */
export abstract class Canvas2DGlobalRenderingBackend<UploadData, RenderState>
  extends Canvas2DRenderingBackendBase
  implements GlobalRenderingBackend<UploadData, RenderState>
{
  uploadData(): void {}

  abstract render(data: UploadData | null, state: RenderState): void
}

/**
 * GPU-side base for `GlobalRenderingBackend` implementations. Inherits the
 * `hal` reference, the pre-allocated uniform scratch buffer, and the
 * HAL-delegating `dispose` from `GpuRenderingBackendBase`. Subclasses implement
 * `uploadData` (push bytes to HAL) and `render`.
 */
export abstract class GpuGlobalRenderingBackend<UploadData, RenderState>
  extends GpuRenderingBackendBase
  implements GlobalRenderingBackend<UploadData, RenderState>
{
  abstract uploadData(data: UploadData): void
  abstract render(data: UploadData | null, state: RenderState): void
}
