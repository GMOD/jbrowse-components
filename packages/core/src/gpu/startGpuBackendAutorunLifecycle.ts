import { action, autorun, observable } from 'mobx'

import type { GpuBackendLifecycleHandle } from './gpuBackendLifecycleHandle.ts'
import type { RenderBlock } from './renderBlock.ts'

export type { GpuBackendLifecycleHandle } from './gpuBackendLifecycleHandle.ts'

/**
 * One per-region upload pipeline: a data source paired with the dispatch
 * function that pushes one region's data to the GPU.
 *
 * Plugins typically supply one (`uploads: [single]`); plugins with multiple
 * independent data sources sharing one backend (alignments: pileup + arcs)
 * supply two.
 *
 * Anything `upload()` reads from the model is tracked by mobx — color,
 * scale, summary mode, etc. — and changing any of them re-fires only the
 * affected per-key autoruns. When the data map uses `observable.map`,
 * changing one region's value re-uploads only that region; when settings
 * `upload()` reads change, every key's inner autorun fires (all regions
 * re-upload, which is the desired behavior since every region must be
 * re-encoded under the new setting).
 */
export interface RegionUpload<BackendType, RegionDataType> {
  /**
   * Per-region data map. Using `observable.map` here gives per-key
   * reactivity — changing one entry fires only that key's autorun. A plain
   * `Map` still works but forfeits per-key selectivity.
   */
  getData: () => ReadonlyMap<number, RegionDataType>

  /**
   * Push one region's data to the GPU. Any observable read inside (e.g.
   * `model.gpuProps()`) is tracked by mobx, so the per-key autorun re-fires
   * and re-uploads when those settings change.
   */
  upload: (
    backend: BackendType,
    regionNumber: number,
    data: RegionDataType,
  ) => void

  /**
   * Tell the backend which regions are still active so it can free buffers
   * for the rest. Optional — omit when this upload shares pruning with
   * another (e.g. alignments' arcs share the pileup backend's region slots).
   * Fires only when the key set changes.
   */
  prune?: (backend: BackendType, activeRegionNumbers: number[]) => void

  /**
   * Fires once per regionNumber that disappears from the data map. Use
   * when the backend is shared across displays and per-key GPU resources
   * must be freed (`prune` fires once with the active set — not enough to
   * know *which* key went away).
   */
  deleteOne?: (backend: BackendType, regionNumber: number) => void
}

export interface StartGpuBackendAutorunLifecycleArgs<
  BackendType,
  RenderStateType,
> {
  backend: BackendType

  /**
   * One or more independent upload pipelines.
   */
  uploads: RegionUpload<BackendType, any>[]

  /**
   * Reads the list of on-screen render blocks. Typically a cached MST view
   * that calls `buildRenderBlocks(view.visibleRegions)`.
   */
  renderBlocks: () => RenderBlock[]

  /**
   * Reads the per-frame render state, or `undefined` to skip the render
   * pass for this iteration (uploads still happen).
   */
  renderState: () => RenderStateType | undefined

  /**
   * Issues the draw call(s) for all visible blocks using the current render
   * state. Only invoked once at least one region has uploaded (or when
   * `uploads` is empty, e.g. an aggregator view with no per-region data of
   * its own).
   */
  render: (
    backend: BackendType,
    blocks: RenderBlock[],
    state: RenderStateType,
  ) => void
}

/**
 * Wire the full upload → render lifecycle for a GPU display backend.
 *
 * Per upload pipeline: one outer autorun tracks only the key set in
 * `getData()`. For each key present, an inner autorun reads that key's
 * value and calls `upload()`. Key additions spawn a new inner; key
 * removals dispose the inner and fire `deleteOne`. Value changes at a
 * single key re-fire only that inner autorun (selective re-upload).
 *
 * Observables read inside `upload()` (e.g. `self.gpuProps()`) are tracked
 * by each inner autorun, so a settings change fires every inner
 * simultaneously — behaviorally identical to the single-autorun version
 * for cross-region settings, but selective for per-region data changes.
 *
 * One render autorun: reads `renderBlocks` + `renderState` + a shared
 * upload counter. State-only changes (hover) re-fire only this autorun.
 */
export function startGpuBackendAutorunLifecycle<BackendType, RenderStateType>(
  args: StartGpuBackendAutorunLifecycleArgs<BackendType, RenderStateType>,
): GpuBackendLifecycleHandle {
  const { backend, uploads, renderBlocks, renderState, render } = args

  const uploadSignal = observable.box(0, { deep: false })
  const bumpUploadSignal = action(() => {
    uploadSignal.set(uploadSignal.get() + 1)
  })
  let lastRenderBlocks: RenderBlock[] = []
  let lastRenderState: RenderStateType | undefined
  // Suppresses initial render passes that would draw an empty canvas
  // before any region's bytes are on the GPU. Aggregator lifecycles with
  // no per-region uploads short-circuit this gate.
  let hasUploadedAny = uploads.length === 0

  const perUploadDisposers = uploads.map(u => {
    const perKeyDisposers = new Map<number, () => void>()

    const outerDispose = autorun(() => {
      const dataMap = u.getData()
      // Iterating `.keys()` tracks only the key set on observable.map
      // (and whole-map identity on plain Map) — values are observed
      // individually inside each per-key inner autorun below.
      const currentKeys = new Set<number>()
      for (const k of dataMap.keys()) {
        currentKeys.add(k)
      }

      for (const k of currentKeys) {
        if (!perKeyDisposers.has(k)) {
          const innerDispose = autorun(() => {
            // Re-read via getData() so plugins that still replace their
            // volatile with `self.x = new Map(...)` (legacy pattern) pick
            // up the fresh reference rather than the closure-captured one.
            const data = u.getData().get(k)
            if (data === undefined) {
              return
            }
            u.upload(backend, k, data)
            hasUploadedAny = true
            bumpUploadSignal()
          })
          perKeyDisposers.set(k, innerDispose)
        }
      }

      for (const [k, dispose] of perKeyDisposers) {
        if (!currentKeys.has(k)) {
          dispose()
          perKeyDisposers.delete(k)
          u.deleteOne?.(backend, k)
        }
      }

      const activeKeys: number[] = []
      for (const k of currentKeys) {
        activeKeys.push(k)
      }
      u.prune?.(backend, activeKeys)
    })

    return () => {
      outerDispose()
      for (const dispose of perKeyDisposers.values()) {
        dispose()
      }
      perKeyDisposers.clear()
    }
  })

  const disposeRender = autorun(() => {
    uploadSignal.get()
    const blocks = renderBlocks()
    const state = renderState()
    lastRenderBlocks = blocks
    lastRenderState = state
    if (state !== undefined && hasUploadedAny) {
      render(backend, blocks, state)
    }
  })

  let isDisposed = false
  return {
    dispose() {
      if (isDisposed) {
        return
      }
      isDisposed = true
      disposeRender()
      for (const dispose of perUploadDisposers) {
        dispose()
      }
    },
    renderNow() {
      if (isDisposed || lastRenderState === undefined || !hasUploadedAny) {
        return
      }
      render(backend, lastRenderBlocks, lastRenderState)
    },
  }
}
