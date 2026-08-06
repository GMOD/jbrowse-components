import { ErrorBar } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

// `error` is `unknown` to match FetchMixin's volatile (which preserves
// non-Error throws); ErrorBar normalizes at the boundary.
export interface DisplayErrorBarModel {
  error: unknown
  reload: () => void
}

// `visible` is `displayPhase === 'error'`, passed in like the other two
// mounted-unconditionally overlays. It used to re-derive its own visibility
// from `model.error`, which agreed with the phase only by construction — the
// same "re-encode the precedence by subtraction" the phase exists to retire,
// and the one overlay of the three still doing it.
const DisplayErrorBar = observer(function DisplayErrorBar({
  model,
  visible,
}: {
  model: DisplayErrorBarModel
  visible: boolean
}) {
  return visible && model.error ? (
    <ErrorBar
      error={model.error}
      onRetry={() => {
        model.reload()
      }}
    />
  ) : null
})

export default DisplayErrorBar
