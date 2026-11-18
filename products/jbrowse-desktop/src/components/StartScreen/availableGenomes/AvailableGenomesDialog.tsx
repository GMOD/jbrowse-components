import { Dialog } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import GenomesDataTable from './GenomesDataTable.tsx'

import type { Fav, LaunchCallback } from '../types.ts'

// the dialog takes the window's height whatever the row count, and the table
// scrolls inside it
const useStyles = makeStyles()({
  paper: {
    height: '100%',
    '& > .MuiScopedCssBaseline-root': {
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minHeight: 0,
    },
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
  },
})

const AvailableGenomesDialog = observer(function AvailableGenomesDialog({
  favorites,
  setFavorites,
  onClose,
  launch,
}: {
  onClose: () => void
  favorites: Fav[]
  setFavorites: (arg: Fav[]) => void
  launch: LaunchCallback
}) {
  const { classes } = useStyles()
  return (
    <Dialog
      maxWidth="xl"
      fullWidth
      open
      title="Available genomes"
      onClose={onClose}
      slotProps={{ paper: { className: classes.paper } }}
    >
      <DialogContent className={classes.content}>
        <GenomesDataTable
          favorites={favorites}
          setFavorites={setFavorites}
          onClose={onClose}
          launch={launch}
        />
      </DialogContent>
    </Dialog>
  )
})

export default AvailableGenomesDialog
