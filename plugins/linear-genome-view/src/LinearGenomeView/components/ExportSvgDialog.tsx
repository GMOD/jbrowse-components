import React, { useState } from 'react'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import CircularProgress from '@mui/material/CircularProgress'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import FormControlLabel from '@mui/material/FormControlLabel'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Dialog from '@jbrowse/core/ui/Dialog'
import ErrorMessage from '@jbrowse/core/ui/ErrorMessage'
import { ExportSvgOptions } from '..'

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
  return (
    <Dialog open onClose={handleClose} title="Export SVG">
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
