import React, { useState } from 'react'
import { makeStyles } from '@material-ui/core/styles'
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Checkbox,
  FormControlLabel,
} from '@material-ui/core'
import CloseIcon from '@material-ui/icons/Close'
import { LinearGenomeViewModel as LGV } from '..'

const useStyles = makeStyles(theme => ({
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
}))

export default function ExportSvgDlg({
  view,
  handleClose,
}: {
  view: LGV
  handleClose: () => void
}) {
  const [fullSvg, setFullSVG] = useState(true)
  const classes = useStyles()
  return (
    <Dialog open onClose={handleClose}>
      <DialogTitle>
        Export SVG
        <IconButton className={classes.closeButton} onClick={handleClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <FormControlLabel
          control={
            <Checkbox
              checked={fullSvg}
              onChange={() => setFullSVG(val => !val)}
            />
          }
          label="Rasterize canvas based tracks or use full SVG based rendering? Note: full SVG based rendering file sizes can be very larger"
        />

        <Button
          variant="contained"
          color="primary"
          type="submit"
          style={{ marginLeft: 20 }}
          onClick={async () => {
            await view.exportSvg({ fullSvg })
            handleClose()
          }}
        >
          Submit
        </Button>
      </DialogContent>
    </Dialog>
  )
}
