import { isRegionTooLargeError } from '@jbrowse/core/rpc/byteBudget'
import { isLiveModel, tooLargeBannerText } from '@jbrowse/display-ui'
import { observer } from 'mobx-react'

import type { DisplayChromeOverlays } from '@jbrowse/display-ui'

/** What the error slot reads: a failed fetch, and the way to run it again. */
export interface ErrorSource {
  error: unknown
  reload: () => void
}

/** What the too-large slot reads. */
export interface TooLargeSource {
  regionTooLargeReason: string
  zoomCanReleaseGate: boolean
  forceLoad: () => void
}

/** What the loading and background-progress slots read. */
export interface StatusSource {
  statusMessage?: string
  statusProgress?: number
  fetchCanceled?: boolean
  cancelFetchByUser?: () => void
  reload?: () => void
}

// Each slot reads the display model for one overlay and hands it plain values,
// so a status tick re-renders that slot and not the chrome around it, and
// every overlay set gets the same rules: a byte-gate error offers no Retry, and
// a button pressed after the track closed calls nothing.

export const ErrorBarSlot = observer(function ErrorBarSlot({
  model,
  ErrorBar,
}: {
  model: ErrorSource
  ErrorBar: DisplayChromeOverlays['ErrorBar']
}) {
  const { error } = model
  return error ? (
    <ErrorBar
      error={error}
      onRetry={
        isRegionTooLargeError(error)
          ? undefined
          : () => {
              if (isLiveModel(model)) {
                model.reload()
              }
            }
      }
    />
  ) : null
})

export const TooLargeSlot = observer(function TooLargeSlot({
  model,
  TooLarge,
}: {
  model: TooLargeSource
  TooLarge: DisplayChromeOverlays['TooLarge']
}) {
  return (
    <TooLarge
      message={tooLargeBannerText(model.regionTooLargeReason, {
        zoomCanRelease: model.zoomCanReleaseGate,
      })}
      onForceLoad={() => {
        if (isLiveModel(model)) {
          model.forceLoad()
        }
      }}
    />
  )
})

export const LoadingSlot = observer(function LoadingSlot({
  model,
  Loading,
  visible,
  immediate,
}: {
  model: StatusSource
  Loading: DisplayChromeOverlays['Loading']
  visible: boolean
  immediate?: boolean
}) {
  return (
    <Loading
      visible={visible}
      immediate={immediate}
      message={model.statusMessage}
      progress={model.statusProgress}
      canceled={model.fetchCanceled}
      onCancel={
        model.cancelFetchByUser
          ? () => {
              if (isLiveModel(model)) {
                model.cancelFetchByUser?.()
              }
            }
          : undefined
      }
      onRetry={
        model.reload
          ? () => {
              if (isLiveModel(model)) {
                model.reload?.()
              }
            }
          : undefined
      }
    />
  )
})

/** The chip for a status message set while the phase is `ready`. */
export const BackgroundProgressSlot = observer(function BackgroundProgressSlot({
  model,
  BackgroundProgress,
  visible,
}: {
  model: StatusSource
  BackgroundProgress: DisplayChromeOverlays['BackgroundProgress']
  visible: boolean
}) {
  return visible && model.statusMessage ? (
    <BackgroundProgress
      message={model.statusMessage}
      progress={model.statusProgress}
    />
  ) : null
})
