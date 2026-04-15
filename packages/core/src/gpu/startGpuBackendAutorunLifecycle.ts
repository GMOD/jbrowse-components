import { autorun } from 'mobx'

import type { RenderBlock } from './renderBlock.ts'

export interface StartGpuBackendAutorunLifecycleArgs<
  BackendType,
  RegionDataType,
  RenderStateType,
> {
  backend: BackendType

  /**
   * Reads the per-region data currently owned by the model, keyed by
   * displayedRegionIndex (a.k.a. `regionNumber`). Called inside the autorun,
   * so MobX observable reads here establish the reactive dependency: when the
   * map or any observable read during its computation changes, the autorun
   * re-fires.
   *
   * The identity check for re-upload is done against the *values* in this
   * map, so the model should produce fresh value objects only when a region's
   * uploaded bytes actually need to change. The MST idiom of replacing the
   * whole Map reference on every commit (shallow copy) works because individual
   * value references stay the same for regions whose data didn't change.
   */
  getDataByRegionNumber: () => Map<number, RegionDataType>

  /**
   * Reads the list of on-screen render blocks. Typically a cached MST view
   * that calls `buildRenderBlocks(view.visibleRegions)`. A single displayed
   * region may appear in multiple blocks (shared GPU buffer, different
   * scissor clips).
   */
  getRenderBlocks: () => RenderBlock[]

  /**
   * Reads the per-frame render state, or `undefined` to skip the render pass
   * for this autorun iteration (upload/prune still happen). Typically a
   * cached MST view that returns `undefined` while the view isn't
   * initialized.
   */
  getRenderState: () => RenderStateType | undefined

  /**
   * Bridges the generic upload to the plugin-specific backend API. Called
   * once per region whose data reference changed since the last pass. This
   * closure typically also reads other observables (e.g. color scheme) via
   * `self`; those reads are tracked by the autorun.
   */
  uploadOneRegion: (
    backend: BackendType,
    regionNumber: number,
    data: RegionDataType,
  ) => void

  /**
   * Tells the backend which regions are still active, so it can free GPU
   * buffers for the ones that aren't.
   */
  pruneRegionsNotIn: (
    backend: BackendType,
    activeRegionNumbers: number[],
  ) => void

  /**
   * Issues the draw call(s) for all visible blocks using the current render
   * state. Called last in each autorun pass after uploads.
   */
  renderAllBlocks: (
    backend: BackendType,
    blocks: RenderBlock[],
    state: RenderStateType,
  ) => void

  /**
   * Optional post-pass hook, e.g. to call `model.setCanvasDrawn(true)`. The
   * argument is whether there were any uploaded regions this pass.
   */
  onAfterCommit?: (didHaveUploadedRegions: boolean) => void

  /**
   * Optional invalidation token. When its value changes between autorun
   * iterations, the per-region upload cache is cleared and every region
   * re-uploads on the next pass. Used by plugins whose upload bytes depend
   * on model state that isn't part of the per-region data object itself
   * (e.g. multi-wiggle's `sources` array controls row ordering packed into
   * the instance buffer). The value is never inspected beyond reference or
   * `Object.is` comparison — typically a number counter or an array
   * reference.
   */
  getUploadInvalidationToken?: () => unknown
}

export interface GpuBackendAutorunLifecycleHandle {
  /** Dispose the autorun. Safe to call multiple times. */
  dispose: () => void
  /**
   * Imperatively re-issue the last render pass using the currently cached
   * blocks/state. Intended for non-MobX triggers where the autorun wouldn't
   * naturally re-fire (DOM scroll events on an internal container, tab
   * visibility, `webglcontextrestored`).
   *
   * If the observer pattern naturally re-fires the autorun for a state
   * change, you do NOT need to call this.
   */
  renderNow: () => void
}

/**
 * Wire up the full upload → prune → render lifecycle for a GPU display
 * backend. Returns a handle with a disposer and a `renderNow` escape hatch.
 *
 * This is intentionally NOT a React hook: the lifecycle is owned by the MST
 * display model (in a `.volatile()` slot), which keeps reactivity in one
 * place — MobX observables → cached MST views → this autorun. React
 * components become thin: they just create a canvas, hand the resulting
 * backend to `model.attachGpuBackend(backend)`, and render JSX.
 *
 * Upload identity contract: when a region's value in `getDataByRegionNumber()`
 * is the same reference as last pass, the upload is skipped. Plugins must
 * therefore produce a fresh value object whenever a region's uploaded bytes
 * need to change. The MST models in this codebase already obey this via
 * `setLoadedRegionForRegion` etc.
 */
export function startGpuBackendAutorunLifecycle<
  BackendType,
  RegionDataType,
  RenderStateType,
>({
  backend,
  getDataByRegionNumber,
  getRenderBlocks,
  getRenderState,
  uploadOneRegion,
  pruneRegionsNotIn,
  renderAllBlocks,
  onAfterCommit,
  getUploadInvalidationToken,
}: StartGpuBackendAutorunLifecycleArgs<
  BackendType,
  RegionDataType,
  RenderStateType
>): GpuBackendAutorunLifecycleHandle {
  const lastUploadedByRegionNumber = new Map<number, RegionDataType>()
  let lastRenderBlocks: RenderBlock[] = []
  let lastRenderState: RenderStateType | undefined
  let lastUploadInvalidationToken: unknown = Symbol('initial')

  const disposeAutorun = autorun(() => {
    const dataByRegionNumber = getDataByRegionNumber()
    const invalidationToken = getUploadInvalidationToken?.()
    if (
      getUploadInvalidationToken !== undefined &&
      !Object.is(invalidationToken, lastUploadInvalidationToken)
    ) {
      lastUploadedByRegionNumber.clear()
      lastUploadInvalidationToken = invalidationToken
    }
    const activeRegionNumbers: number[] = []

    for (const [regionNumber, data] of dataByRegionNumber) {
      activeRegionNumbers.push(regionNumber)
      if (lastUploadedByRegionNumber.get(regionNumber) !== data) {
        uploadOneRegion(backend, regionNumber, data)
        lastUploadedByRegionNumber.set(regionNumber, data)
      }
    }
    for (const cachedRegionNumber of lastUploadedByRegionNumber.keys()) {
      if (!dataByRegionNumber.has(cachedRegionNumber)) {
        lastUploadedByRegionNumber.delete(cachedRegionNumber)
      }
    }
    pruneRegionsNotIn(backend, activeRegionNumbers)

    const blocks = getRenderBlocks()
    const state = getRenderState()
    lastRenderBlocks = blocks
    lastRenderState = state
    if (state !== undefined) {
      renderAllBlocks(backend, blocks, state)
    }
    onAfterCommit?.(activeRegionNumbers.length > 0)
  })

  let isDisposed = false
  return {
    dispose() {
      if (isDisposed) {
        return
      }
      isDisposed = true
      disposeAutorun()
      lastUploadedByRegionNumber.clear()
    },
    renderNow() {
      if (isDisposed || lastRenderState === undefined) {
        return
      }
      renderAllBlocks(backend, lastRenderBlocks, lastRenderState)
    },
  }
}
