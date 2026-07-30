import { InfoDialog } from '@jbrowse/core/ui'
import { Alert, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearComparativeViewModel } from '../model.ts'

const SyntenyWarningsDialog = observer(function SyntenyWarningsDialog({
  model,
  handleClose,
}: {
  model: LinearComparativeViewModel
  handleClose: () => void
}) {
  const { syntenyWarnings: warnings } = model
  return (
    <InfoDialog
      open
      title="Synteny warnings"
      onClose={() => {
        handleClose()
      }}
    >
      {/* keyed by position: two levels of a stacked view raise the same
        swapped-assemblies warning verbatim, so the message is not an identity */}
      {warnings.map((w, idx) => (
        <Alert
          // eslint-disable-next-line @eslint-react/no-array-index-key -- see above
          key={idx}
          severity="warning"
          style={{ marginBottom: 8 }}
        >
          <Typography variant="subtitle2">{w.message}</Typography>
          {w.effect}
        </Alert>
      ))}
    </InfoDialog>
  )
})

export default SyntenyWarningsDialog
