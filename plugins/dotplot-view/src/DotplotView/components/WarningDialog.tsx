import { InfoDialog } from '@jbrowse/core/ui'
import { measureGridWidth } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { DialogContentText } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import { observer } from 'mobx-react'

import type { TrackWarning } from '@jbrowse/synteny-core'

const useStyles = makeStyles()({
  content: {
    minWidth: 600,
  },
  grid: {
    height: 600,
    width: '100%',
    overflow: 'auto',
  },
})

// Already flattened to (track name, its warnings) by the model, which is what
// knows how to reach a display's warnings — see `DotplotView.trackWarnings`.
function getTrackWarnings({
  trackWarnings,
}: {
  trackWarnings: TrackWarning[]
}) {
  return trackWarnings.flatMap(({ name, warnings }, i) =>
    warnings.map((w, j) => ({ name, ...w, id: `${i}_${j}` })),
  )
}

const WarningDialog = observer(function WarningDialog({
  trackWarnings,
  handleClose,
}: {
  handleClose: () => void
  trackWarnings: TrackWarning[]
}) {
  const { classes } = useStyles()
  const rows = getTrackWarnings({ trackWarnings })
  const columns = [
    { field: 'name' },
    { field: 'message', width: measureGridWidth(rows.map(r => r.message)) },
    { field: 'effect', width: measureGridWidth(rows.map(r => r.effect)) },
  ]
  return (
    <InfoDialog
      open
      onClose={() => {
        handleClose()
      }}
      maxWidth="xl"
      title="Dotplot rendered with warnings"
    >
      <div className={classes.content}>
        <DialogContentText>
          Found warnings while rendering the dotplot. This is often due to
          out-of-bound features that may indicate the wrong assemblies are being
          used. Check that the query and target are configured correctly, and
          that the right assemblies are being compared.
        </DialogContentText>
        <div className={classes.grid}>
          <DataGrid
            rows={rows}
            columns={columns}
            disableRowSelectionOnClick
            rowHeight={25}
            disableColumnMenu
          />
        </div>
      </div>
    </InfoDialog>
  )
})

export default WarningDialog
