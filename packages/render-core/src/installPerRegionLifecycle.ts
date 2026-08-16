import { addDisposer } from '@jbrowse/mobx-state-tree'
import { autorun, observable } from 'mobx'

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
 * here: `installPerRegionLifecycle`'s per-key autorun tracks `map.get(key)` —
 * the entry, not its contents (ADR-017) — and a whole-map consumer tracks the
 * keys atom. Both still fire on the `.set`/`.delete`/`.clear` that is the only
 * way an entry ever changes.
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

/**
 * Per-region streamed upload for any GPU display whose data is keyed by
 * displayedRegionIndex. Each `rpcDataMap` key gets its own autorun, so a new
 * region's arrival re-uploads only that region (O(1)) while an encoding-input
 * change re-fires every per-key autorun (O(N) re-encode).
 *
 * `encode` runs inside the per-key autorun, so any observable it reads (e.g.
 * a config-derived view) is auto-tracked. Returning `undefined` skips the
 * upload for this tick — the autorun stays subscribed and re-fires once the
 * missing input (e.g. a theme-derived encoder param) becomes available.
 *
 * **Which makes what `encode` reads a performance contract, not a detail.**
 * Every observable it touches re-encodes every region, so it must read a getter
 * narrowed to what actually lands in the buffer — maf's and wiggle's
 * `gpuProps()`, multi-row features' `featurePaintInputs` — and never the
 * display's whole `renderState`. That one carries the canvas box and the row
 * geometry, none of which is encoded (the shader gets them as uniforms) and all
 * of which moves on every frame of a height drag or a window resize: the
 * display then rebuilds tens of MB of byte-identical buffer per frame, with
 * nothing on screen to say so. See render-core/CLAUDE.md.
 *
 * Successful encode results are cached in an internal map and passed to
 * `render` so stateless renderers (wiggle) can draw from it without
 * re-encoding per frame. Renderers that read `rpcDataMap` directly can
 * ignore the second arg.
 *
 * `render` owns the per-frame draw call and returns whether anything was
 * actually drawn (gates the `canvasDrawn` flag — see RenderingBackendCallbacks).
 *
 * **Only the first call's `encode`/`render` ever run.** Callers wire this from
 * `startRenderingBackend`, which fires again on every context-loss recovery, and
 * `attachRenderingBackend` keeps the callbacks it was given first — so a later
 * call's closures, and the `encodedRegions` map inside them, are dead on
 * arrival. The recovery still works, and not by luck: the per-key autoruns read
 * `self.currentRenderingBackend` rather than the `backend` argument, so they
 * re-fire and re-upload every region into the fresh one. What does not work is
 * *changing* an `encode` or a `render` by calling again — that silently keeps
 * the old one. Same constraint the three `create*UploadSync` helpers state, and
 * the reason they say to build their closure outside the
 * `attachRenderingBackend` call.
 *
 * @see installPerRegionLifecycle.test.ts — pins the O(1)-per-new-key /
 * O(N)-per-setting-change autorun semantics this helper exists for.
 */
export function installPerRegionLifecycle<
  Data,
  Encoded,
  B extends UploadableRenderingBackend<Encoded>,
>(
  self: LifecycleHost,
  rpcDataMap: ObservableMap<number, Data>,
  backend: B,
  encode: (data: Data) => Encoded | undefined,
  render: PerRegionRender<B, Encoded>,
) {
  const encodedRegions = new Map<number, Encoded>()
  const perKeyDisposers = new Map<number, () => void>()
  addDisposer(self, () => {
    for (const dispose of perKeyDisposers.values()) {
      dispose()
    }
  })

  self.attachRenderingBackend<B>(backend, {
    upload: b => {
      const activeKeys = new Set(rpcDataMap.keys())
      for (const key of activeKeys) {
        if (!perKeyDisposers.has(key)) {
          perKeyDisposers.set(
            key,
            autorun(() => {
              // `data` may be undefined briefly during a delete race —
              // the outer autorun disposes this one on next tick.
              const data = rpcDataMap.get(key)
              const bCurrent = self.currentRenderingBackend as B | undefined
              if (data !== undefined && bCurrent !== undefined) {
                // A throw in `encode`/`uploadRegion` is routed to renderError
                // (same rationale as RenderLifecycleMixin's upload/render
                // autoruns): uncaught here it would strand the display on
                // 'loading' with no retry. renderError unmounts the canvas and
                // disposes the backend, so it can't loop.
                try {
                  const encoded = encode(data)
                  if (encoded !== undefined) {
                    encodedRegions.set(key, encoded)
                    bCurrent.uploadRegion(key, encoded)
                    self.renderNow()
                  }
                } catch (e) {
                  self.setRenderError(e)
                }
              }
            }),
          )
        }
      }
      for (const [key, dispose] of perKeyDisposers) {
        if (!activeKeys.has(key)) {
          dispose()
          perKeyDisposers.delete(key)
          encodedRegions.delete(key)
        }
      }
      b.pruneRegions(activeKeys)
    },
    render: b => render(b, encodedRegions),
  })
}
