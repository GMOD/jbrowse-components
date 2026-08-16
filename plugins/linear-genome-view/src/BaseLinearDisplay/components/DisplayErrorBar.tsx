import ErrorBar from '@jbrowse/core/ui/ErrorBar'
import { observer } from 'mobx-react'

import type { DisplayErrorBarModel } from '@jbrowse/display-ui'

// The model shape lives with the contract, not here: a replacement set is
// written against it, and it cannot be reachable only through the Material
// implementation of the thing it describes. Re-exported because every display
// already names it from this plugin.
// `error` is `unknown` to match FetchMixin's volatile (which preserves
// non-Error throws); ErrorBar normalizes at the boundary.
export type { DisplayErrorBarModel }

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
