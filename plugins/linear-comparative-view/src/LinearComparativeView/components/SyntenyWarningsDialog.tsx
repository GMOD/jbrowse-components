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
  const { trackWarnings } = model
  return (
    <InfoDialog
      open
      title="Synteny warnings"
      onClose={() => {
        handleClose()
      }}
    >
      {/* Grouped by track, and the track name leads each row: a stacked view's
        levels raise the same swapped-assemblies warning verbatim, and so does
        every overlaid track that hits it, so an ungrouped list repeated one
        sentence N times without ever naming the file to go fix.

        Still keyed by position — the message is not an identity, and neither is
        the track name once one track raises two warnings. */}
      {trackWarnings.flatMap(({ name, warnings }, i) =>
        warnings.map((w, j) => (
          <Alert
            // eslint-disable-next-line @eslint-react/no-array-index-key -- see above
            key={`${i}_${j}`}
            severity="warning"
            style={{ marginBottom: 8 }}
          >
            <Typography variant="subtitle2">
              {name}: {w.message}
            </Typography>
            {w.effect}
          </Alert>
        )),
      )}
    </InfoDialog>
  )
})

export default SyntenyWarningsDialog
