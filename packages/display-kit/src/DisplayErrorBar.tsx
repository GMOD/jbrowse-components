import { isRegionTooLargeError } from '@jbrowse/core/rpc/byteBudget'
import ErrorBar from '@jbrowse/core/ui/ErrorBar'
import { observer } from 'mobx-react'

import BlockMsg from './BlockMsg.tsx'

import type { DisplayErrorBarModel } from '@jbrowse/display-ui'

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
