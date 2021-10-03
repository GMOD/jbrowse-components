import React, { useState } from 'react'
import { makeStyles } from '@material-ui/core/styles'
import {
  Button,
  Dialog,
  DialogActions,
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
  model,
  handleClose,
}: {
  model: LGV
  handleClose: () => void
}) {
  // @ts-ignore
  const offscreenCanvas = typeof OffscreenCanvas !== 'undefined'
  const [rasterizeLayers, setRasterizeLayers] = useState(offscreenCanvas)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error>()
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
        {error ? (
          <div style={{ color: 'red' }}>{`${error}`}</div>
        ) : loading ? (
          <div>
            <CircularProgress size={20} style={{ marginRight: 20 }} />
            <Typography display="inline">Creating SVG</Typography>
          </div>
        ) : null}
        {offscreenCanvas ? (
          <FormControlLabel
            control={
              <Checkbox
                checked={rasterizeLayers}
                onChange={() => setRasterizeLayers(val => !val)}
              />
            }
            label="Rasterize canvas based tracks? File may be much larger if this is turned off"
          />
        ) : (
          <Typography>
            Note: rasterizing layers not yet supported in this browser, so SVG
            size may be large
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => handleClose()}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          color="primary"
          type="submit"
          onClick={async () => {
            setLoading(true)
            setError(undefined)
            try {
              await model.exportSvg({ rasterizeLayers })
              handleClose()
            } catch (e: any) {
              console.error(e)
              setError(e)
            } finally {
              setLoading(false)
            }
          }}
        >
          Submit
        </Button>
      </DialogActions>
    </Dialog>
  )
}
