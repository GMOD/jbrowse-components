import { autorun } from 'mobx'

/**
 * Lifecycle for GPU backends that hold a single global dataset rather than
 * a per-region cache. Used by HiC (whole-contact-matrix), LD (whole-matrix),
 * and variant-matrix (whole-heatmap) — displays whose data has no natural
 * "displayed region" breakdown.
 *
 * Mirror of `startGpuBackendAutorunLifecycle` for the regional case, with a
 * simpler shape: one upload function, one render function, identity-diff on
 * the single data object. No prune step, since there's nothing to prune.
 */
export interface StartGpuSingleDataBackendAutorunLifecycleArgs<
  BackendType,
  GlobalDataType,
  RenderStateType,
> {
  backend: BackendType

  /**
   * Returns the single global data object. Called inside the autorun; MobX
   * reads here establish the reactive dependency. Return `undefined` while
   * the data hasn't arrived yet — the upload and render passes are both
   * skipped for that iteration.
   */
  getGlobalData: () => GlobalDataType | undefined

  /**
   * Returns the per-frame render state, or `undefined` to skip the render
   * pass. The upload pass still runs independently.
   */
  getRenderState: () => RenderStateType | undefined

  /**
   * Bridges to the backend's plugin-specific upload method. Called only when
   * the data reference has changed since the last pass.
   */
  uploadGlobalData: (backend: BackendType, data: GlobalDataType) => void

  /**
   * Issues the draw call(s) for the current render state.
   */
  renderWithState: (backend: BackendType, state: RenderStateType) => void

  /**
   * Optional post-pass hook, e.g. to call `model.setCanvasDrawn(true)`.
   * Receives whether there is currently uploaded data on the GPU.
   */
  onAfterCommit?: (hasUploadedData: boolean) => void
}

export interface GpuSingleDataBackendAutorunLifecycleHandle {
  dispose: () => void
  /**
   * Imperatively re-issue the last render using the currently cached state.
   * Intended for non-MobX triggers (tab visibility, DOM scroll, context
   * restored).
   */
  renderNow: () => void
}

export function startGpuSingleDataBackendAutorunLifecycle<
  BackendType,
  GlobalDataType,
  RenderStateType,
>({
  backend,
  getGlobalData,
  getRenderState,
  uploadGlobalData,
  renderWithState,
  onAfterCommit,
}: StartGpuSingleDataBackendAutorunLifecycleArgs<
  BackendType,
  GlobalDataType,
  RenderStateType
>): GpuSingleDataBackendAutorunLifecycleHandle {
  let lastUploadedData: GlobalDataType | undefined
  let lastRenderState: RenderStateType | undefined

  const disposeAutorun = autorun(() => {
    const data = getGlobalData()

    if (data !== undefined && data !== lastUploadedData) {
      uploadGlobalData(backend, data)
      lastUploadedData = data
    } else if (data === undefined) {
      lastUploadedData = undefined
    }

    const state = getRenderState()
    lastRenderState = state
    if (state !== undefined && lastUploadedData !== undefined) {
      renderWithState(backend, state)
    }
    onAfterCommit?.(lastUploadedData !== undefined)
  })

  let isDisposed = false
  return {
    dispose() {
      if (isDisposed) {
        return
      }
      isDisposed = true
      disposeAutorun()
      lastUploadedData = undefined
      lastRenderState = undefined
    },
    renderNow() {
      if (
        isDisposed ||
        lastRenderState === undefined ||
        lastUploadedData === undefined
      ) {
        return
      }
      renderWithState(backend, lastRenderState)
    },
  }
}
