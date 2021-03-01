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
  CircularProgress,
  Typography,
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
  const [rasterizeLayers, setRasterizeLayers] = useState(true)
  const [loading, setLoading] = useState(false)
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
        {loading ? (
          <Typography>
            Creating SVG
            <CircularProgress style={{ marginLeft: 20 }} size={20} />
          </Typography>
        ) : null}
        <FormControlLabel
          control={
            <Checkbox
              checked={rasterizeLayers}
              onChange={() => setRasterizeLayers(val => !val)}
            />
          }
          label="Rasterize canvas based tracks? File may be much larger if this is turned off"
        />

        <Button
          variant="contained"
          color="primary"
          type="submit"
          onClick={async () => {
            setLoading(true)
            await view.exportSvg({ fullSvg: !rasterizeLayers })
            setLoading(false)
            handleClose()
          }}
        >
          Submit
        </Button>
      </DialogContent>
    </Dialog>
  )
}
