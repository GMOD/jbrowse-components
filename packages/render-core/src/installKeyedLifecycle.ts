import { createKeyedUploadSync } from './keyedUploadSync.ts'

import type { LifecycleHost } from './RenderLifecycleMixin.ts'

interface KeyedRenderingBackend<T> {
  uploadGeometry(key: number, data: T): void
  deleteGeometry(key: number): void
}

/**
 * Stable 32-bit slot for a display on a backend it shares with siblings, hashed
 * from its MST node id (djb2). Collisions are vanishingly rare at display
 * cardinalities, and the alternative — coordinating integer slots between
 * displays that don't know about each other — is worse.
 *
 * Key by this, never by the display's index in its parent's list. An index
 * renumbers when a sibling is hidden or reordered, which hands the survivor a
 * slot holding another display's bytes: the keyed diff sees a
 * changed reference and re-uploads every later display's whole buffer, and any
 * frame drawn between the two mistakes one display's geometry for another's.
 */
export function sharedBackendKey(id: string) {
  let h = 5381
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) + h + id.charCodeAt(i)) | 0
  }
  return h >>> 0
}

export interface KeyedLifecycle<T, B> {
  /**
   * This display's slice of the shared canvas, keyed by
   * {@link sharedBackendKey}. Read inside the upload autorun, so a commit by
   * any sibling re-runs the diff and only the entries that moved re-upload.
   */
  entries: () => ReadonlyMap<number, T>
  render: (backend: B) => boolean
}

/**
 * Upload lifecycle for a backend **several displays share**, each owning one
 * keyed geometry slot — the dotplot view's canvas and the synteny level's,
 * where the keys belong to sibling displays rather than to regions.
 *
 * The prune is what separates this from
 * `installPerRegionLifecycle`: a departed key is deleted individually, because
 * an active-set prune computed from one display's view of the map would wipe
 * the siblings' buffers.
 *
 * @see keyedUploadSync.test.ts for the diff, installKeyedLifecycle.test.ts for
 * the wiring.
 */
export function installKeyedLifecycle<T, B extends KeyedRenderingBackend<T>>(
  self: LifecycleHost,
  backend: B,
  { entries, render }: KeyedLifecycle<T, B>,
) {
  self.attachRenderingBackend<B>(backend, () => {
    const syncKeys = createKeyedUploadSync<T, B>()
    return {
      upload: b => syncKeys(b, entries()),
      render,
    }
  })
}
