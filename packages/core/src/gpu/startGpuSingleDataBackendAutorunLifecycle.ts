import { autorun } from 'mobx'

import type { GpuBackendLifecycleHandle } from './gpuBackendLifecycleHandle.ts'

export type { GpuBackendLifecycleHandle } from './gpuBackendLifecycleHandle.ts'

/**
 * Describes one identity-diffed upload slot for a global (non-regional)
 * GPU display. Each slot is independently tracked: when `readData()`
 * returns a different object reference than last pass, `commitUpload` is
 * called with the new data.
 *
 * A plugin with multiple independent uploads (e.g. HiC: contact matrix
 * bytes plus color ramp) passes one slot per upload. Plugins with a single
 * upload pass a one-element list.
 */
export interface GpuGlobalUploadSlot<BackendType, DataType> {
  readData: () => DataType | undefined
  commitUpload: (backend: BackendType, data: DataType) => void
}

export interface StartGpuSingleDataBackendAutorunLifecycleArgs<
  BackendType,
  RenderStateType,
> {
  backend: BackendType

  /**
   * One or more independent upload slots. Each slot's data is identity-diffed
   * separately, and `commitUpload` fires only when its own slot's data
   * reference changes. All slots run inside the same autorun, so they
   * share one render pass.
   */
  uploadSlots: GpuGlobalUploadSlot<BackendType, unknown>[]

  /**
   * Returns the per-frame render state, or `undefined` to skip the render
   * pass. Upload slots still run independently of render.
   */
  getRenderState: () => RenderStateType | undefined

  /**
   * Issues the draw call(s) for the current render state.
   */
  renderWithState: (backend: BackendType, state: RenderStateType) => void

  /**
   * Optional post-pass hook. Receives whether every slot has uploaded data
   * currently on the GPU.
   */
  onAfterCommit?: (allSlotsHaveData: boolean) => void
}

/**
 * Lifecycle for GPU backends that hold one or more global (non-regional)
 * datasets rather than a per-region cache. Used by HiC (contact matrix +
 * color ramp), LD (matrix), variant-matrix (heatmap), etc.
 *
 * Mirror of `startGpuBackendAutorunLifecycle` for the non-regional case.
 * Supports multiple independently identity-diffed upload slots so plugins
 * like HiC, which upload both a data buffer and a color ramp, can track
 * each upload separately without re-uploading everything when one changes.
 */
export function startGpuSingleDataBackendAutorunLifecycle<
  BackendType,
  RenderStateType,
>({
  backend,
  uploadSlots,
  getRenderState,
  renderWithState,
  onAfterCommit,
}: StartGpuSingleDataBackendAutorunLifecycleArgs<
  BackendType,
  RenderStateType
>): GpuBackendLifecycleHandle {
  const lastUploadedPerSlot: unknown[] = uploadSlots.map(() => undefined)
  let lastRenderState: RenderStateType | undefined
  let allSlotsHaveData = false

  const disposeAutorun = autorun(() => {
    let allPresent = true
    for (let i = 0; i < uploadSlots.length; i++) {
      const slot = uploadSlots[i]!
      const data = slot.readData()
      if (data === undefined) {
        allPresent = false
        lastUploadedPerSlot[i] = undefined
        continue
      }
      if (lastUploadedPerSlot[i] !== data) {
        slot.commitUpload(backend, data)
        lastUploadedPerSlot[i] = data
      }
    }
    allSlotsHaveData = allPresent

    const state = getRenderState()
    lastRenderState = state
    if (state !== undefined && allPresent) {
      renderWithState(backend, state)
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
      for (let i = 0; i < lastUploadedPerSlot.length; i++) {
        lastUploadedPerSlot[i] = undefined
      }
      lastRenderState = undefined
      allSlotsHaveData = false
    },
    renderNow() {
      if (isDisposed || lastRenderState === undefined || !allSlotsHaveData) {
        return
      }
      renderWithState(backend, lastRenderState)
    },
  }
}
