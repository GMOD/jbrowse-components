import { autorun, observable, runInAction } from 'mobx'

import type { GpuBackendLifecycleHandle } from './gpuBackendLifecycleHandle.ts'
import type { RenderBlock } from './renderBlock.ts'

export type { GpuBackendLifecycleHandle } from './gpuBackendLifecycleHandle.ts'

/**
 * One upload track — a per-region data map with its own identity-diff cache,
 * upload dispatch, and (optional) prune dispatch. Plugins that have a single
 * upload stream (wiggle, variants-matrix pileup) use `uploadStreams: [one]`;
 * plugins that have independent streams (alignments: pileup + arcs) list
 * them in order.
 */
export interface GpuUploadStream<BackendType, RegionDataType> {
  /**
   * Per-region data map read inside the autorun. MobX observable reads here
   * establish the reactive dependency.
   */
  getDataByRegionNumber: () => Map<number, RegionDataType>

  /**
   * Dispatch upload for one region whose identity changed since the last
   * pass.
   */
  uploadOneRegion: (
    backend: BackendType,
    regionNumber: number,
    data: RegionDataType,
  ) => void

  /**
   * Tell the backend which regions are still active so it can free buffers
   * for the rest. Optional — omit when a stream shares pruning with another
   * stream (e.g. alignments' arcs share the pileup backend's region slots).
   */
  pruneRegionsNotIn?: (
    backend: BackendType,
    activeRegionNumbers: number[],
  ) => void

  /**
   * Compares identity between passes. Defaults to reference equality. Use
   * when data entries are replaced wholesale on every observable change
   * (e.g. `inputKey` string hash for variants).
   */
  identityOf?: (data: RegionDataType) => unknown

  /**
   * When this token's value changes, the per-region cache is cleared and
   * every region re-uploads. Used by plugins whose upload bytes depend on
   * non-region state (multi-wiggle's `sources` array).
   */
  getUploadInvalidationToken?: () => unknown

  /**
   * Fires once per cached key that disappears from dataMap. Use when the
   * backend is shared across displays and per-key GPU resources must be
   * freed (pruneRegionsNotIn fires once with the active set — not enough to
   * know *which* key went away).
   */
  deleteOneRegion?: (backend: BackendType, regionNumber: number) => void
}

export interface StartGpuBackendAutorunLifecycleArgs<
  BackendType,
  RegionDataType,
  RenderStateType,
> {
  backend: BackendType

  /**
   * One or more independent upload streams. Mutually exclusive with the
   * top-level `getDataByRegionNumber`/`uploadOneRegion`/`pruneRegionsNotIn`
   * sugar — which, if present, are wrapped as a single stream.
   */
  uploadStreams?: GpuUploadStream<BackendType, any>[]

  // Single-stream sugar — equivalent to uploadStreams: [{ ... }]
  getDataByRegionNumber?: () => Map<number, RegionDataType>
  uploadOneRegion?: (
    backend: BackendType,
    regionNumber: number,
    data: RegionDataType,
  ) => void
  pruneRegionsNotIn?: (
    backend: BackendType,
    activeRegionNumbers: number[],
  ) => void
  identityOf?: (data: RegionDataType) => unknown
  getUploadInvalidationToken?: () => unknown
  deleteOneRegion?: (backend: BackendType, regionNumber: number) => void

  /**
   * Reads the list of on-screen render blocks. Typically a cached MST view
   * that calls `buildRenderBlocks(view.visibleRegions)`.
   */
  getRenderBlocks: () => RenderBlock[]

  /**
   * Reads the per-frame render state, or `undefined` to skip the render
   * pass for this iteration (upload/prune still happen).
   */
  getRenderState: () => RenderStateType | undefined

  /**
   * Issues the draw call(s) for all visible blocks using the current render
   * state.
   */
  renderAllBlocks: (
    backend: BackendType,
    blocks: RenderBlock[],
    state: RenderStateType,
  ) => void

  /**
   * Optional post-upload hook. Fires after the upload autorun pass,
   * regardless of whether the render autorun ran. Argument is whether any
   * stream had data this pass.
   */
  onAfterCommit?: (didHaveUploadedRegions: boolean) => void
}

interface NormalizedStream<BackendType> {
  getDataByRegionNumber: () => Map<number, unknown>
  uploadOneRegion: (
    backend: BackendType,
    regionNumber: number,
    data: unknown,
  ) => void
  pruneRegionsNotIn?: (
    backend: BackendType,
    activeRegionNumbers: number[],
  ) => void
  identityOf?: (data: unknown) => unknown
  getUploadInvalidationToken?: () => unknown
  deleteOneRegion?: (backend: BackendType, regionNumber: number) => void
  cache: Map<number, unknown>
  lastInvalidationToken: unknown
}

/**
 * Wire the full upload → render lifecycle for a GPU display backend, owned
 * by an MST model.
 *
 * Architecture: two independent autoruns.
 *
 * - Upload autorun tracks per-region data and invalidation tokens. Fires
 *   uploads + prunes + `onAfterCommit`. When anything was uploaded, bumps an
 *   observable counter that the render autorun observes.
 * - Render autorun tracks `getRenderBlocks` + `getRenderState` + the upload
 *   counter. Fires renders. Hover-only state changes that live in
 *   `getRenderState` re-fire only the render autorun — the upload cache walk
 *   is skipped.
 *
 * Upload identity contract: when a stream's entry for region N is the same
 * reference (or produces the same `identityOf` token) as last pass, upload
 * is skipped. MST models in this codebase obey this by reassigning whole
 * Maps on commit — individual entries keep their reference if unchanged.
 */
export function startGpuBackendAutorunLifecycle<
  BackendType,
  RegionDataType,
  RenderStateType,
>(
  args: StartGpuBackendAutorunLifecycleArgs<
    BackendType,
    RegionDataType,
    RenderStateType
  >,
): GpuBackendLifecycleHandle {
  const {
    backend,
    getRenderBlocks,
    getRenderState,
    renderAllBlocks,
    onAfterCommit,
  } = args

  const streams: NormalizedStream<BackendType>[] = []
  if (args.uploadStreams) {
    for (const s of args.uploadStreams) {
      streams.push({
        getDataByRegionNumber: s.getDataByRegionNumber as () => Map<
          number,
          unknown
        >,
        uploadOneRegion:
          s.uploadOneRegion as NormalizedStream<BackendType>['uploadOneRegion'],
        pruneRegionsNotIn: s.pruneRegionsNotIn,
        identityOf: s.identityOf as NormalizedStream<BackendType>['identityOf'],
        getUploadInvalidationToken: s.getUploadInvalidationToken,
        deleteOneRegion: s.deleteOneRegion,
        cache: new Map(),
        lastInvalidationToken: INITIAL_TOKEN,
      })
    }
  }
  if (args.getDataByRegionNumber && args.uploadOneRegion) {
    streams.push({
      getDataByRegionNumber: args.getDataByRegionNumber as () => Map<
        number,
        unknown
      >,
      uploadOneRegion:
        args.uploadOneRegion as NormalizedStream<BackendType>['uploadOneRegion'],
      pruneRegionsNotIn: args.pruneRegionsNotIn,
      identityOf:
        args.identityOf as NormalizedStream<BackendType>['identityOf'],
      getUploadInvalidationToken: args.getUploadInvalidationToken,
      deleteOneRegion: args.deleteOneRegion,
      cache: new Map(),
      lastInvalidationToken: INITIAL_TOKEN,
    })
  }

  const uploadSignal = observable.box(0, { deep: false })
  let lastRenderBlocks: RenderBlock[] = []
  let lastRenderState: RenderStateType | undefined

  const disposeUpload = autorun(() => {
    let uploaded = false
    let anyData = false
    for (const stream of streams) {
      const invalidationToken = stream.getUploadInvalidationToken?.()
      if (
        stream.getUploadInvalidationToken !== undefined &&
        !Object.is(invalidationToken, stream.lastInvalidationToken)
      ) {
        stream.cache.clear()
        stream.lastInvalidationToken = invalidationToken
      }

      const dataMap = stream.getDataByRegionNumber()
      const activeKeys: number[] = []
      const identityOf = stream.identityOf
      for (const [regionNumber, data] of dataMap) {
        activeKeys.push(regionNumber)
        anyData = true
        const key = identityOf ? identityOf(data) : data
        if (stream.cache.get(regionNumber) !== key) {
          stream.uploadOneRegion(backend, regionNumber, data)
          stream.cache.set(regionNumber, key)
          uploaded = true
        }
      }
      for (const cachedKey of stream.cache.keys()) {
        if (!dataMap.has(cachedKey)) {
          stream.deleteOneRegion?.(backend, cachedKey)
          stream.cache.delete(cachedKey)
          uploaded = true
        }
      }
      stream.pruneRegionsNotIn?.(backend, activeKeys)
    }
    if (uploaded) {
      runInAction(() => {
        uploadSignal.set(uploadSignal.get() + 1)
      })
    }
    onAfterCommit?.(anyData)
  })

  const disposeRender = autorun(() => {
    uploadSignal.get()
    const blocks = getRenderBlocks()
    const state = getRenderState()
    lastRenderBlocks = blocks
    lastRenderState = state
    if (state !== undefined) {
      renderAllBlocks(backend, blocks, state)
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
      disposeUpload()
      for (const s of streams) {
        s.cache.clear()
      }
    },
    renderNow() {
      if (isDisposed || lastRenderState === undefined) {
        return
      }
      renderAllBlocks(backend, lastRenderBlocks, lastRenderState)
    },
  }
}

const INITIAL_TOKEN = Symbol('initial')
