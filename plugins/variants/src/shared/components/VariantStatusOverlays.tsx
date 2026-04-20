import { ErrorBar, LoadingOverlay } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

interface VariantStatusModel {
  isDisplayLoading: boolean
  statusMessage?: string
  displayError: unknown
  reload: () => void
}

export const VariantLoadingOverlay = observer(function VariantLoadingOverlay({
  model,
}: {
  model: Pick<VariantStatusModel, 'isDisplayLoading' | 'statusMessage'>
}) {
  return (
    <LoadingOverlay
      statusMessage={model.statusMessage || 'Loading'}
      isVisible={model.isDisplayLoading}
    />
  )
})

export const VariantErrorBar = observer(function VariantErrorBar({
  model,
}: {
  model: Pick<VariantStatusModel, 'displayError' | 'reload'>
}) {
  return model.displayError ? (
    <ErrorBar
      error={model.displayError}
      onRetry={() => {
        model.reload()
      }}
    />
  ) : null
})
