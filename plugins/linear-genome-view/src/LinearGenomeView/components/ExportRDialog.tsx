import { useState } from 'react'

import { Dialog, ErrorMessage } from '@jbrowse/core/ui'
import { getSession, useLocalStorage } from '@jbrowse/core/util'
import {
  Button,
  Checkbox,
  CircularProgress,
  DialogActions,
  DialogContent,
  FormControlLabel,
  Link,
  TextField,
  Typography,
} from '@mui/material'

import type { ExportRCodeOptions } from '../types.ts'

function LoadingMessage() {
  return (
    <div>
      <CircularProgress size={20} style={{ marginRight: 20 }} />
      <Typography display="inline">Generating R script...</Typography>
    </div>
  )
}

function useRLocal<T>(key: string, val: T) {
  return useLocalStorage(`r-export-${key}`, val)
}

export default function ExportRDialog({
  model,
  handleClose,
}: {
  model: { exportR(opts: ExportRCodeOptions): Promise<void> }
  handleClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>()
  const [filename, setFilename] = useRLocal('file', 'jbrowse_view.R')
  const [useJbrowseR, setUseJbrowseR] = useRLocal('usejbrowser', true)
  const [embedData, setEmbedData] = useRLocal('embed', false)

  return (
    <Dialog open onClose={handleClose} title="Export R Script">
      <DialogContent>
        {error ? <ErrorMessage error={error} /> : null}
        {loading ? <LoadingMessage /> : null}

        <div style={{ marginBottom: 16 }}>
          <TextField
            fullWidth
            label="Filename"
            helperText="Output filename for R script"
            value={filename}
            onChange={event => {
              setFilename(event.target.value)
            }}
          />
        </div>

        <FormControlLabel
          control={
            <Checkbox
              checked={useJbrowseR}
              onChange={() => {
                setUseJbrowseR(val => !val)
              }}
            />
          }
          label="Use jbrowseR package (recommended)"
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={embedData}
              onChange={() => {
                setEmbedData(val => !val)
              }}
            />
          }
          label="Embed data inline (larger file, but self-contained)"
        />

        <Typography
          variant="body2"
          color="textSecondary"
          style={{ marginTop: 16 }}
        >
          The generated R script will recreate your current view using ggplot2.
          For best results, install the{' '}
          <Link
            href="https://github.com/GMOD/jbrowseR"
            target="_blank"
            rel="noopener"
          >
            jbrowseR
          </Link>{' '}
          and{' '}
          <Link
            href="https://github.com/GMOD/ggjbrowse"
            target="_blank"
            rel="noopener"
          >
            ggjbrowse
          </Link>{' '}
          packages.
        </Typography>

        {!useJbrowseR ? (
          <Typography
            variant="body2"
            color="warning.main"
            style={{ marginTop: 8 }}
          >
            Without jbrowseR, the script will use Bioconductor packages directly
            (rtracklayer, VariantAnnotation, Rsamtools).
          </Typography>
        ) : null}
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
              await model.exportR({
                filename,
                useJbrowseR,
                embedData,
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
          Export
        </Button>
      </DialogActions>
    </Dialog>
  )
}
