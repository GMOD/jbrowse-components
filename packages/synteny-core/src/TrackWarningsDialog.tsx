import { InfoDialog } from '@jbrowse/core/ui'
import { Alert, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { TrackWarning } from './trackWarnings.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { ReactNode } from 'react'

export interface WarningsHost extends IStateTreeNode {
  trackWarnings: TrackWarning[]
}

/**
 * The render-warnings report both comparative views open, over the rows
 * `collectTrackWarnings` builds for them. Reads them off the view rather than
 * taking a copy, so a refetch that raises or clears a warning while the dialog
 * is open shows in it.
 *
 * Grouped by track, with the track name leading each row: a stacked view's
 * levels raise the same swapped-assemblies warning verbatim, and so does every
 * overlaid track that hits it, so an ungrouped list repeated one sentence N
 * times without ever naming the file to go fix.
 *
 * Keyed by position — the message is not an identity, and neither is the track
 * name once one track raises two warnings.
 */
const TrackWarningsDialog = observer(function TrackWarningsDialog({
  model,
  title,
  children,
  handleClose,
}: {
  model: WarningsHost
  title: string
  children?: ReactNode
  handleClose: () => void
}) {
  return (
    <InfoDialog
      open
      title={title}
      onClose={() => {
        handleClose()
      }}
    >
      {children}
      {model.trackWarnings.flatMap(({ name, warnings }, i) =>
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

export default TrackWarningsDialog
