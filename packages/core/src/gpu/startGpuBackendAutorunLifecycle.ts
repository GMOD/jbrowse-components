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
 * scale, summary mode, etc. — and changing any of them re-fires the
 * autorun and re-uploads. There is no cache, no identity diff, no
 * `gpuProps` hook: mobx is the cache.
 */
export interface RegionUpload<BackendType, RegionDataType> {
  /**
   * Per-region data map. Re-fires the autorun when its contents change.
   */
  getData: () => ReadonlyMap<number, RegionDataType>

  /**
   * Push one region's data to the GPU. Any observable read inside (e.g.
   * `model.gpuProps()`) is tracked by mobx, so the autorun re-fires and
   * re-uploads when those settings change.
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
   * state.
   */
  render: (
    backend: BackendType,
    blocks: RenderBlock[],
    state: RenderStateType,
  ) => void

  /**
   * Optional post-pass hook. Fires after every upload pass; argument is
   * whether any upload had data this pass.
   */
  onAfterCommit?: (didHaveUploadedRegions: boolean) => void
}

/**
 * Wire the full upload → render lifecycle for a GPU display backend.
 *
 * One autorun per upload: reads `getData()`, calls `upload()` for every
 * region in the map. Anything `upload()` reads from the model is mobx-
 * tracked — when any of it changes, the autorun re-fires and re-uploads
 * every region. No cache, no identity diff: mobx is the cache.
 *
 * One render autorun: reads `renderBlocks` + `renderState` + a shared
 * upload counter. State-only changes (hover) re-fire only this autorun.
 */
export function startGpuBackendAutorunLifecycle<BackendType, RenderStateType>(
  args: StartGpuBackendAutorunLifecycleArgs<BackendType, RenderStateType>,
): GpuBackendLifecycleHandle {
  const { backend, uploads, renderBlocks, renderState, render, onAfterCommit } =
    args

  const uploadSignal = observable.box(0, { deep: false })
  const bumpUploadSignal = action(() => {
    uploadSignal.set(uploadSignal.get() + 1)
  })
  let lastRenderBlocks: RenderBlock[] = []
  let lastRenderState: RenderStateType | undefined

  const previousKeys = uploads.map(() => new Set<number>())

  const disposeUploads = uploads.map((u, idx) =>
    autorun(() => {
      const dataMap = u.getData()
      const currentKeys = new Set<number>()
      let anyData = false

      for (const [regionNumber, data] of dataMap) {
        currentKeys.add(regionNumber)
        anyData = true
        u.upload(backend, regionNumber, data)
      }

      const prevSet = previousKeys[idx]!
      for (const regionNumber of prevSet) {
        if (!currentKeys.has(regionNumber)) {
          u.deleteOne?.(backend, regionNumber)
        }
      }
      previousKeys[idx] = currentKeys

      const activeKeys: number[] = []
      for (const k of currentKeys) {
        activeKeys.push(k)
      }
      u.prune?.(backend, activeKeys)

      bumpUploadSignal()
      onAfterCommit?.(anyData)
    }),
  )

  const disposeRender = autorun(() => {
    uploadSignal.get()
    const blocks = renderBlocks()
    const state = renderState()
    lastRenderBlocks = blocks
    lastRenderState = state
    if (state !== undefined) {
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
      for (const dispose of disposeUploads) {
        dispose()
      }
    },
    renderNow() {
      if (isDisposed || lastRenderState === undefined) {
        return
      }
      render(backend, lastRenderBlocks, lastRenderState)
    },
  }
}
