import { isRegionTooLargeError } from '@jbrowse/core/rpc/byteBudget'
import ErrorBar from '@jbrowse/core/ui/ErrorBar'
import { observer } from 'mobx-react'

import BlockMsg from './BlockMsg.tsx'

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
  const { error } = model
  if (!visible || !error) {
    return null
  }
  return isRegionTooLargeError(error) ? (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        pointerEvents: 'auto',
      }}
    >
      <BlockMsg severity="info" message={error.message} />
    </div>
  ) : (
    <ErrorBar
      error={error}
      onRetry={() => {
        model.reload()
      }}
    />
  )
})

export default DisplayErrorBar
