import { useState } from 'react'

import { Dialog, ErrorMessage } from '@jbrowse/core/ui'
import { useLocalStorage } from '@jbrowse/core/util'
import {
  Button,
  CircularProgress,
  DialogActions,
  DialogContent,
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

export default function ExportRDialog({
  model,
  handleClose,
}: {
  model: { exportR(opts: ExportRCodeOptions): Promise<void> }
  handleClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>()
  const [filename, setFilename] = useLocalStorage(
    'r-export-file',
    'jbrowse_view.R',
  )

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

        <Typography
          variant="body2"
          color="textSecondary"
          style={{ marginTop: 16 }}
        >
          The generated R script uses the{' '}
          <Link
            href="https://github.com/GMOD/ggjbrowse"
            target="_blank"
            rel="noopener"
          >
            ggjbrowse
          </Link>{' '}
          package to recreate your current view in ggplot2. It will be
          auto-installed when you run the script.
        </Typography>
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
              await model.exportR({ filename })
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
