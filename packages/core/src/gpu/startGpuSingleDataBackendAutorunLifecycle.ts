import { autorun } from 'mobx'

import type { GpuBackendLifecycleHandle } from './gpuBackendLifecycleHandle.ts'

export type { GpuBackendLifecycleHandle } from './gpuBackendLifecycleHandle.ts'

/**
 * One identity-diffed upload for a global (non-regional) GPU display. Each
 * upload is independently tracked: when `getData()` returns a different
 * object reference than last pass, `upload` is called with the new data.
 *
 * A plugin with multiple independent uploads (e.g. HiC: contact matrix
 * bytes plus color ramp) passes one entry per upload. Plugins with a
 * single upload pass a one-element list.
 */
export interface GlobalUpload<BackendType, DataType> {
  getData: () => DataType | undefined
  upload: (backend: BackendType, data: DataType) => void
}

export interface StartGpuSingleDataBackendAutorunLifecycleArgs<
  BackendType,
  RenderStateType,
> {
  backend: BackendType

  /**
   * One or more independent uploads. Each entry's data is identity-diffed
   * separately, and `upload` fires only when its own entry's data
   * reference changes. All entries run inside the same autorun, so they
   * share one render pass.
   */
  uploads: GlobalUpload<BackendType, unknown>[]

  /**
   * Returns the per-frame render state, or `undefined` to skip the render
   * pass. Uploads still run independently of render.
   */
  renderState: () => RenderStateType | undefined

  /**
   * Issues the draw call(s) for the current render state.
   */
  render: (backend: BackendType, state: RenderStateType) => void

  /**
   * Optional post-pass hook. Receives whether every upload has data
   * currently on the GPU.
   */
  onAfterCommit?: (allHaveData: boolean) => void
}

/**
 * Lifecycle for GPU backends that hold one or more global (non-regional)
 * datasets rather than a per-region cache. Used by HiC (contact matrix +
 * color ramp), LD (matrix), variant-matrix (heatmap), etc.
 *
 * Mirror of `startGpuBackendAutorunLifecycle` for the non-regional case.
 * Supports multiple independently identity-diffed uploads so plugins
 * like HiC, which upload both a data buffer and a color ramp, can track
 * each separately without re-uploading everything when one changes.
 */
export function startGpuSingleDataBackendAutorunLifecycle<
  BackendType,
  RenderStateType,
>({
  backend,
  uploads,
  renderState,
  render,
  onAfterCommit,
}: StartGpuSingleDataBackendAutorunLifecycleArgs<
  BackendType,
  RenderStateType
>): GpuBackendLifecycleHandle {
  const lastUploaded: unknown[] = uploads.map(() => undefined)
  let lastRenderState: RenderStateType | undefined
  let allHaveData = false

  const disposeAutorun = autorun(() => {
    let allPresent = true
    for (let i = 0; i < uploads.length; i++) {
      const u = uploads[i]!
      const data = u.getData()
      if (data === undefined) {
        allPresent = false
        lastUploaded[i] = undefined
        continue
      }
      if (lastUploaded[i] !== data) {
        u.upload(backend, data)
        lastUploaded[i] = data
      }
    }
    allHaveData = allPresent

    const state = renderState()
    lastRenderState = state
    if (state !== undefined && allPresent) {
      render(backend, state)
    }
    onAfterCommit?.(allPresent)
  })

  let isDisposed = false
  return {
    dispose() {
      if (isDisposed) {
        return
      }
      isDisposed = true
      disposeAutorun()
      for (let i = 0; i < lastUploaded.length; i++) {
        lastUploaded[i] = undefined
      }
      lastRenderState = undefined
      allHaveData = false
    },
    renderNow() {
      if (isDisposed || lastRenderState === undefined || !allHaveData) {
        return
      }
      render(backend, lastRenderState)
    },
  }
}
