import { computed, observable } from 'mobx'

import { createRegionUploadSync } from './regionUploadSync.ts'

import type { RenderingBackendCallbacks } from './RenderLifecycleMixin.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { ObservableMap } from 'mobx'

/**
 * The volatile a display keys its per-region worker payloads by
 * (`displayedRegionIndex` → result). Every one of them in tree is built with
 * this, so "how is per-region data represented" has one answer — see
 * ADR-060.
 *
 * **Shallow, and that follows from an invariant the codebase already states**:
 * per-region values are freshly constructed and never mutated (agent-docs
 * CLAUDE.md; backends diff by reference identity). Nothing inside an entry can
 * therefore change, so the deep enhancer's field-level atoms can never fire —
 * they are unreachable reactivity, not a safety margin. What they do cost is
 * paid on every insert and every read:
 *
 * - **Insert.** `deepEnhancer` recursively rebuilds each payload as an
 *   observable object graph — the stored value is not the object the worker
 *   produced. A multi-wiggle region is one atom per field per source, so a
 *   thousand-sample track pays ~18k on every pan; MAF pays the whole set again
 *   for every cached region on every row reorder, since `placeFetchedRows`
 *   re-places them all.
 * - **Read.** Each field access goes through `getObservablePropValue_`. Hot
 *   loops that hoist their typed arrays are fine, but the ones that don't were
 *   paying it per iteration.
 *
 * Typed arrays and class instances (Flatbush) pass through the deep enhancer
 * untouched, so the arrays were never the cost — the objects holding them were.
 *
 * Coarser tracking is the only behavioral difference, and it is unobservable
 * here: an entry is only ever replaced whole, so the keys atom and the entry's
 * own atom fire on exactly the same `.set`/`.delete`/`.clear`.
 *
 * Not for maps of primitives (`groupMaxHeightOverrides`,
 * `detectedModifications`), where the enhancer is a no-op, nor for UI state
 * whose values are mutated in place.
 */
export function regionDataMap<T>(): ObservableMap<number, T> {
  return observable.map<number, T>(undefined, { deep: false })
}

export interface LifecycleHost extends IStateTreeNode {
  attachRenderingBackend: <B>(b: B, cbs: RenderingBackendCallbacks<B>) => void
  renderNow: () => void
  setRenderError: (error: unknown) => void
  currentRenderingBackend: unknown
}

interface UploadableRenderingBackend<Encoded> {
  uploadRegion(displayedRegionIndex: number, encoded: Encoded): void
  pruneRegions(active: Iterable<number>): void
}

/**
 * Render callback signature for per-region lifecycles. The second argument
 * is the latest encoded-output map kept by the helper — wiggle reads from
 * it because its renderer is stateless and needs the encoded form per
 * frame; plugins whose renderer reads `rpcDataMap` directly (manhattan,
 * MAF, variants) ignore the second argument. Return `true` if anything was
 * drawn (flips `canvasDrawn` — see RenderLifecycle).
 */
export type PerRegionRender<B, Encoded> = (
  backend: B,
  encoded: ReadonlyMap<number, Encoded>,
) => boolean

export interface PerRegionUpload<Data, Props, Encoded, B> {
  /**
   * Everything `encode` needs beyond the region's own data, as one value.
   * Omit it for an encode that needs nothing (an identity encode).
   *
   * **The helper memoizes this and re-encodes on its identity**, so it decides
   * how often every loaded region is rebuilt. Return the narrow thing —
   * wiggle's and MAF's `gpuProps()`, multi-row features' `featurePaintInputs`
   * — never the display's `renderState`, which carries the canvas box and the
   * row geometry: none of that is encoded (the shader takes it as uniforms)
   * and all of it moves on every frame of a height drag or a window resize.
   */
  inputs?: () => Props
  /**
   * Build one region's upload payload. Pure in `(data, props)`: reading an
   * observable directly here still works, but it does not invalidate anything
   * — only `data` and `inputs` do. Return `undefined` to skip this region for
   * now, keeping any payload it already has; the run re-fires once whatever
   * `inputs` reads changes.
   */
  encode: (data: Data, props: Props) => Encoded | undefined
  render: PerRegionRender<B, Encoded>
}

/**
 * Per-region streamed upload for a display whose data is keyed by
 * `displayedRegionIndex` and whose regions encode independently.
 *
 * One upload autorun over the whole map, with two reference diffs under it:
 * a region re-encodes when its own entry is replaced or when `inputs` changes,
 * and re-uploads when its encoded payload changes — {@link createRegionUploadSync},
 * the same diff every other per-region upload in the tree runs on. A region
 * arrival costs one upload and one encode no matter how many regions are
 * loaded; an `inputs` change costs N of each, which is what it means.
 *
 * **`encode`'s reads no longer decide anything, and that is the point.** They
 * are still tracked — they run inside the upload autorun — so a wide read
 * re-runs the *diff*, which finds nothing changed and encodes nothing. The
 * failure that shape used to cause (a `renderState` read rebuilding tens of MB
 * of byte-identical buffer on every frame of a resize) needs `inputs` to be
 * wrong now, where it is one declaration per display rather than a property of
 * a closure. See render-core/CLAUDE.md.
 *
 * `render` owns the per-frame draw call and returns whether anything was
 * actually drawn (gates the `canvasDrawn` flag — see RenderingBackendCallbacks).
 * It receives the encoded map so a stateless renderer (wiggle) can draw from it
 * without re-encoding; renderers that read `rpcDataMap` directly ignore it.
 *
 * **Only the first call's callbacks ever run.** Callers wire this from
 * `startRenderingBackend`, which fires again on every context-loss recovery,
 * and `attachRenderingBackend` keeps the callbacks it was given first. Recovery
 * still works: the upload autorun reads `self.currentRenderingBackend`, and the
 * diff re-uploads every region into a backend it has not seen — without
 * re-encoding, since the payloads are still good and only the GPU buffers are
 * gone. What does not work is *changing* an `encode` or a `render` by calling
 * again.
 *
 * @see installPerRegionLifecycle.test.ts — pins the upload and encode counts
 * this helper exists for.
 * @see ADR-078 — why this is one autorun and a diff rather than ADR-017's
 * autorun per key.
 */
export function installPerRegionLifecycle<
  Data,
  Props,
  Encoded,
  B extends UploadableRenderingBackend<Encoded>,
>(
  self: LifecycleHost,
  rpcDataMap: ObservableMap<number, Data>,
  backend: B,
  { inputs, encode, render }: PerRegionUpload<Data, Props, Encoded, B>,
) {
  const encoded = new Map<number, Encoded>()
  const encodedFrom = new Map<number, Data>()
  const syncRegions = createRegionUploadSync<Encoded, B>()
  // A computed, not a plain call: `inputs` is free to build a fresh object
  // (`gpuProps()` does), and the identity of that object is what re-encodes
  // every region. Memoized, it changes when what `inputs` reads changes, which
  // is the invalidation the display means.
  const props = inputs && computed(inputs)
  let lastProps: Props | undefined

  self.attachRenderingBackend<B>(backend, {
    upload: b => {
      const p = props ? props.get() : (undefined as Props)
      if (p !== lastProps) {
        lastProps = p
        encodedFrom.clear()
      }
      for (const [key, data] of rpcDataMap) {
        if (encodedFrom.get(key) !== data) {
          const payload = encode(data, p)
          if (payload !== undefined) {
            encoded.set(key, payload)
            encodedFrom.set(key, data)
          }
        }
      }
      for (const key of encoded.keys()) {
        if (!rpcDataMap.has(key)) {
          encoded.delete(key)
          encodedFrom.delete(key)
        }
      }
      syncRegions(b, encoded)
    },
    render: b => render(b, encoded),
  })
}
