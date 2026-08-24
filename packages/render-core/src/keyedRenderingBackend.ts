import type { RenderingBackend } from './renderingBackendBase.ts'

/**
 * Shared contract for **keyed shared-canvas** backends — one canvas painting
 * several displays at once, each holding its own uploaded buffer under its own
 * key. Dotplot (a key per display in the view) and multi-LGV synteny (a key per
 * track level) are the two.
 *
 * The third shape beside per-region and monolithic, and genuinely neither:
 * per-region drives off `renderBlocks(blocks, regions, state)` with the model's
 * data map handed back each frame, and monolithic is one payload under the `data` key
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
  upload(key: number, data: UploadData): void
  release(key: number): void
  /** Paint every key the state names. */
  render(state: RenderState): void
}

/**
 * Stable 32-bit slot for a display on a backend it shares with siblings, hashed
 * from its MST node id (djb2). Collisions are vanishingly rare at display
 * cardinalities, and the alternative — coordinating integer slots between
 * displays that don't know about each other — is worse.
 *
 * Key by this, never by the display's index in its parent's list. An index
 * renumbers when a sibling is hidden or reordered, which hands the survivor a
 * slot holding another display's bytes: the keyed diff sees a changed
 * reference and re-uploads every later display's whole buffer, and any frame
 * drawn between the two mistakes one display's geometry for another's.
 */
export function sharedBackendKey(id: string) {
  let h = 5381
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) + h + id.charCodeAt(i)) | 0
  }
  return h >>> 0
}
