import React, { useState } from 'react'
import { Dialog, ErrorMessage } from '@jbrowse/core/ui'
import { getSession, useLocalStorage } from '@jbrowse/core/util'
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

// locals
import type { ExportSvgOptions } from '../models/model'
import type { TextFieldProps } from '@mui/material'

function LoadingMessage() {
  return (
    <div>
      <CircularProgress size={20} style={{ marginRight: 20 }} />
      <Typography display="inline">Creating SVG</Typography>
    </div>
  )
}

function TextField2({ children, ...rest }: TextFieldProps) {
  return (
    <div>
      <TextField {...rest}>{children}</TextField>
    </div>
  )
}
function useSvgLocal<T>(key: string, val: T) {
  return useLocalStorage(`svg-${key}`, val)
}

export default function ExportSvgDialog({
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
  const [error, setError] = useState<unknown>()
  const [filename, setFilename] = useSvgLocal('file', 'jbrowse.svg')
  const [themeName, setThemeName] = useSvgLocal(
    'theme',
    session.themeName || 'default',
  )
  return (
    <Dialog open onClose={handleClose} title="Export SVG">
      <DialogContent>
        {error ? (
          <ErrorMessage error={error} />
        ) : loading ? (
          <LoadingMessage />
        ) : null}
        <TextField2
          helperText="filename"
          value={filename}
          onChange={event => {
            setFilename(event.target.value)
          }}
        />

        {session.allThemes ? (
          <TextField2
            select
            label="Theme"
            value={themeName}
            onChange={event => {
              setThemeName(event.target.value)
            }}
          >
            {Object.entries(session.allThemes()).map(([key, val]) => (
              <MenuItem key={key} value={key}>
                {
                  // @ts-expect-error
                  val.name || '(Unknown name)'
                }
              </MenuItem>
            ))}
          </TextField2>
        ) : null}
        {offscreenCanvas ? (
          <FormControlLabel
            control={
              <Checkbox
                checked={rasterizeLayers}
                onChange={() => {
                  setRasterizeLayers(val => !val)
                }}
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
          onClick={() => {
            handleClose()
          }}
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
                themeName,
              })
              handleClose()
            } catch (e) {
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
