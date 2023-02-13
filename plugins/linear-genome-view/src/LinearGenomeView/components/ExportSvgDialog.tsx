import React, { useState } from 'react'
import {
  Button,
  Checkbox,
  CircularProgress,
  DialogActions,
  DialogContent,
  FormControlLabel,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import { Dialog, ErrorMessage } from '@jbrowse/core/ui'
import { ExportSvgOptions } from '..'
import { getSession } from '@jbrowse/core/util'

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
  model: { exportSvg(opts: ExportSvgOptions): Promise<void> }
  handleClose: () => void
}) {
  const session = getSession(model)
  const offscreenCanvas = typeof OffscreenCanvas !== 'undefined'
  const [rasterizeLayers, setRasterizeLayers] = useState(offscreenCanvas)
  const [loading, setLoading] = useState(false)
  const [filename, setFilename] = useState('jbrowse.svg')
  const [trackNames, setTrackNames] = useState('offset')
  const [error, setError] = useState<unknown>()
  const [themeName, setThemeName] = useState(session.themeName)
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
        <br />
        <TextField
          select
          label="Track labels"
          value={trackNames}
          onChange={event => setTrackNames(event.target.value)}
        >
          <MenuItem value={'offset'}>Offset</MenuItem>
          <MenuItem value={'overlay'}>Overlay</MenuItem>
          <MenuItem value={'left'}>Left</MenuItem>
          <MenuItem value={'none'}>None</MenuItem>
        </TextField>
        <br />
        <TextField
          select
          label="Theme"
          value={themeName}
          onChange={event => setThemeName(event.target.value)}
        >
          {Object.entries(session.allThemes()).map(([key, val]) => (
            <MenuItem key={key} value={key}>
              {
                // @ts-ignore
                val.name || '(Unknown name)'
              }
            </MenuItem>
          ))}
        </TextField>

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
              await model.exportSvg({
                rasterizeLayers,
                filename,
                fontSize: 15,
                rulerHeight: 50,
                textHeight: 20,
                paddingHeight: 20,
                headerHeight: 40,
                cytobandHeight: 100,
                trackNames,
                themeName,
              })
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
