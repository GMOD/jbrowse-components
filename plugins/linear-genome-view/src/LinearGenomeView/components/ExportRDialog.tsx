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

export default function ExportRDialog({
  model,
  handleClose,
}: {
  model: { exportR: (opts: ExportRCodeOptions) => Promise<void> }
  handleClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>()
  const [filename, setFilename] = useLocalStorage(
    'r-export-file',
    'jbrowse_view.R',
  )

  return (
    <Dialog open onClose={() => { handleClose() }} title="Export R script">
      <DialogContent>
        {error ? <ErrorMessage error={error} /> : null}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CircularProgress size={20} />
            <Typography>Generating R script...</Typography>
          </div>
        ) : null}

        <TextField
          fullWidth
          label="Filename"
          helperText="Output filename for the R script"
          value={filename}
          onChange={event => {
            setFilename(event.target.value)
          }}
        />

        <Typography
          variant="body2"
          color="textSecondary"
          style={{ marginTop: 16 }}
        >
          The script defines a <code>plot_region(chrom, start, end)</code>{' '}
          function that reads each track straight from its source file and
          redraws the view, so you can loop it over many regions. It is plain{' '}
          <Link
            href="https://bioconductor.org/packages/rtracklayer/"
            target="_blank"
            rel="noopener"
          >
            rtracklayer
          </Link>{' '}
          + ggplot2 with no bespoke package, so you can edit the geoms and theme
          however you like.
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
