import { ErrorBar } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

// `error` is `unknown` to match FetchMixin's volatile (which preserves
// non-Error throws); ErrorBar normalizes at the boundary.
export interface DisplayErrorBarModel {
  error: unknown
  reload: () => void
}

const DisplayErrorBar = observer(function DisplayErrorBar({
  model,
}: {
  model: DisplayErrorBarModel
}) {
  return model.error ? (
    <ErrorBar
      error={model.error}
      onRetry={() => {
        model.reload()
      }}
    />
  ) : null
})

export default DisplayErrorBar
