import { InfoDialog } from '@jbrowse/core/ui'
import { Alert, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { TrackWarning } from './trackWarnings.ts'
import type { ReactNode } from 'react'

/**
 * The render-warnings report both comparative views open, over the rows
 * `collectTrackWarnings` already builds for them. The data layer was shared and
 * the presentation was not: the dotplot tabulated the same three fields in a
 * fixed-height `DataGrid` with unlabelled columns, which for the two or three
 * rows a report actually has was 600px of chrome around one sentence — and left
 * two places to add a field to.
 *
 * Takes the rows rather than a view, since that is all either caller has in
 * common. `title` differs because each view names itself in its own report.
 *
 * Grouped by track, with the track name leading each row: a stacked view's
 * levels raise the same swapped-assemblies warning verbatim, and so does every
 * overlaid track that hits it, so an ungrouped list repeated one sentence N
 * times without ever naming the file to go fix.
 *
 * Still keyed by position — the message is not an identity, and neither is the
 * track name once one track raises two warnings.
 */
const TrackWarningsDialog = observer(function TrackWarningsDialog({
  trackWarnings,
  title,
  children,
  handleClose,
}: {
  trackWarnings: TrackWarning[]
  title: string
  // an explanation of what these warnings usually mean, which the dotplot has
  // and the synteny view does not
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

export default TrackWarningsDialog
