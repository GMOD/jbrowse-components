import React, { useState } from 'react'
import { makeStyles } from 'tss-react/mui'
import {
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  TextField,
  Typography,
} from '@mui/material'
import { ErrorMessage } from '@jbrowse/core/ui'
import CloseIcon from '@mui/icons-material/Close'
import { ExportSvgOptions } from '..'

const useStyles = makeStyles()(theme => ({
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
}))

function LoadingMessage() {
  return (
    <div>
      <CircularProgress size={20} style={{ marginRight: 20 }} />
      <Typography display="inline">Creating SVG</Typography>
    </div>
  )
}

export default function ExportSvgDlg({
  model,
  handleClose,
}: {
  model: { exportSvg(opts: ExportSvgOptions): void }
  handleClose: () => void
}) {
  // @ts-ignore
  const offscreenCanvas = typeof OffscreenCanvas !== 'undefined'
  const [rasterizeLayers, setRasterizeLayers] = useState(offscreenCanvas)
  const [loading, setLoading] = useState(false)
  const [filename, setFilename] = useState('jbrowse.svg')
  const [error, setError] = useState<unknown>()
  const { classes } = useStyles()
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
          <ErrorMessage error={error} />
        ) : loading ? (
          <LoadingMessage />
        ) : null}
        <TextField
          helperText="filename"
          value={filename}
          onChange={event => setFilename(event.target.value)}
        />
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
              await model.exportSvg({ rasterizeLayers, filename })
              handleClose()
            } catch (e) {
              console.error(e)
              setError(e)
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
