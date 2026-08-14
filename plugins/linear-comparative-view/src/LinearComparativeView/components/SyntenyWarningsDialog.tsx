import { TrackWarningsDialog } from '@jbrowse/synteny-core'
import { observer } from 'mobx-react'

import type { LinearComparativeViewModel } from '../model.ts'

// The synteny view's binding of the shared render-warnings report. Takes the
// model (rather than the rows) because the affordance that opens it queues a
// dialog by component + props, and the rows have to stay live: a refetch that
// raises or clears a warning while the dialog is open should be visible in it.
const SyntenyWarningsDialog = observer(function SyntenyWarningsDialog({
  model,
  handleClose,
}: {
  model: LinearComparativeViewModel
  handleClose: () => void
}) {
  return (
    <TrackWarningsDialog
      trackWarnings={model.trackWarnings}
      title="Synteny warnings"
      handleClose={handleClose}
    />
  )
})

export default SyntenyWarningsDialog
