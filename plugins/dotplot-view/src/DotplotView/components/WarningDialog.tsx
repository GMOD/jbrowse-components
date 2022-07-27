import React from 'react'
import { Dialog, DialogContent, DialogTitle, IconButton } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import { getConf } from '@jbrowse/core/configuration'

// icons
import CloseIcon from '@mui/icons-material/Close'

const useStyles = makeStyles()(theme => ({
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
  content: {
    minWidth: 800,
  },
}))

function WarningDialog({
  warnings,
  handleClose,
}: {
  handleClose: () => void
  warnings: any
}) {
  const { classes } = useStyles()
  return (
    <Dialog open onClose={handleClose} maxWidth="xl">
      <DialogTitle>
        Warnings
        <IconButton
          className={classes.closeButton}
          onClick={() => handleClose()}
          size="large"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent className={classes.content}>
        <table>
          <tbody>
            {warnings.map(track => (
              <tr>
                <td>{getConf(track, 'name')}</td>
                <td>{track.displays[0].warnings.join(',')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DialogContent>
    </Dialog>
  )
}

export default observer(WarningDialog)
