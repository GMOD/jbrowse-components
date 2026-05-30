import { ErrorBar } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

// `error` is `unknown` to match FetchMixin's volatile (which preserves
// non-Error throws); ErrorBar normalizes at the boundary.
const DisplayErrorBar = observer(function DisplayErrorBar({
  model,
}: {
  model: { error: unknown; reload: () => void }
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
