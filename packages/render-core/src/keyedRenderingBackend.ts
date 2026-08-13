import type { RenderingBackend } from './renderingBackendBase.ts'

/**
 * Shared contract for **keyed shared-canvas** backends — one canvas painting
 * several displays at once, each holding its own uploaded buffer under its own
 * key. Dotplot (a key per display in the view) and multi-LGV synteny (a key per
 * track level) are the two.
 *
 * The third shape beside per-region and monolithic, and genuinely neither:
 * per-region drives off `renderBlocks(blocks, regions, state)` with the model's
 * data map handed back each frame, and monolithic is one bulk `uploadData`
 * with no key at all. These key their uploads and render every key in one
 * frame from state the caller assembled, so they own the map.
 *
 * Unlike the other two this is an interface with no abstract class under it:
 * the shared *state* (`hal` + uniform scratch, or `canvas` + 2D context) is
 * `GpuRenderingBackendBase` / `Canvas2DRenderingBackendBase`, which every keyed
 * backend extends, and there is no shared *behavior* on top — the render loops
 * genuinely differ. An empty abstract class between them would only be a place
 * to look.
 */
export interface KeyedRenderingBackend<
  UploadData,
  RenderState,
> extends RenderingBackend {
  /** CSS-pixel size of the shared canvas. */
  resize(width: number, height: number): void
  uploadGeometry(key: number, data: UploadData): void
  deleteGeometry(key: number): void
  /** Paint every key the state names. */
  render(state: RenderState): void
}
