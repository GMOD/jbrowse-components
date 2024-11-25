import React from 'react'
import { getConf } from '@jbrowse/core/configuration'
import { Dialog } from '@jbrowse/core/ui'
import { measureGridWidth } from '@jbrowse/core/util'
import { DialogContent, DialogContentText } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const useStyles = makeStyles()({
  content: {
    minWidth: 600,
  },
})

interface TrackWarning {
  configuration: AnyConfigurationModel
  displays: { warnings: { message: string; effect: string }[] }[]
}

const WarningDialog = observer(function WarningDialog({
  trackWarnings,
  handleClose,
}: {
  handleClose: () => void
  trackWarnings: TrackWarning[]
}) {
  const { classes } = useStyles()
  const rows = [] as {
    name: string
    message: string
    effect: string
    id: string
  }[]
  for (let i = 0; i < trackWarnings.length; i++) {
    const track = trackWarnings[i]!
    const name = getConf(track, 'name')
    const d = track.displays[0]!
    for (let j = 0; j < d.warnings.length; j++) {
      const warning = d.warnings[j]!
      rows.push({ name, ...warning, id: `${i}_${j}` })
    }
  }
  const columns = [
    { field: 'name' },
    { field: 'message', width: measureGridWidth(rows.map(r => r.message)) },
    { field: 'effect', width: measureGridWidth(rows.map(r => r.effect)) },
  ]
  return (
    <Dialog
      open
      onClose={handleClose}
      maxWidth="xl"
      title="Dotplot rendered with warnings"
    >
      <DialogContent className={classes.content}>
        <DialogContentText>
          Found warnings while rendering the dotplot. This is often due to
          out-of-bound features that may indicate the wrong assemblies are being
          used. Check that the query and target are configured correctly, and
          that the right assemblies are being compared.
        </DialogContentText>
        <div style={{ height: 600, width: '100%', overflow: 'auto' }}>
          <DataGrid
            rows={rows}
            columns={columns}
            disableRowSelectionOnClick
            rowHeight={25}
            disableColumnMenu
          />
        </div>
      </DialogContent>
    </Dialog>
  )
})

export default WarningDialog
