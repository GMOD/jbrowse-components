import { useState } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { Dialog, ErrorMessage } from '@jbrowse/core/ui'
import { useLocalStorage } from '@jbrowse/core/util'
import {
  Alert,
  Button,
  CircularProgress,
  DialogActions,
  DialogContent,
  Link,
  TextField,
  Typography,
} from '@mui/material'

import {
  BROWSER_LOCAL_FILE_ADVICE,
  readsBrowserLocalFile,
} from '../rexportLocalFiles.ts'

import type { LinearGenomeViewModel } from '../model.ts'

/**
 * Shown tracks the script will have to leave out, named here rather than only
 * in the downloaded file's header: the export otherwise succeeds, so the
 * missing track is discovered later, in R.
 */
function localFileTrackNames(model: LinearGenomeViewModel) {
  return model.tracks
    .filter(track => readsBrowserLocalFile(getConf(track, 'adapter')))
    .map(
      (track): string => getConf(track, 'name') || track.configuration.trackId,
    )
}

export default function ExportRDialog({
  model,
  handleClose,
}: {
  model: LinearGenomeViewModel
  handleClose: () => void
}) {
  const localFileTracks = localFileTrackNames(model)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>()
  const [filename, setFilename] = useLocalStorage(
    'r-export-file',
    'jbrowse_view.R',
  )

  return (
    <Dialog
      open
      onClose={() => {
        handleClose()
      }}
      title="Export R script"
    >
      <DialogContent>
        {error ? <ErrorMessage error={error} /> : null}
        {localFileTracks.length > 0 ? (
          <Alert severity="warning" style={{ marginBottom: 16 }}>
            <Typography variant="body2">
              {localFileTracks.length === 1
                ? `The track "${localFileTracks[0]}" was opened from a local file, so it cannot be included: `
                : `${localFileTracks.length} tracks were opened from local files, so they cannot be included (${localFileTracks.join(', ')}): `}
              the script reads each track from its own path, and a file opened
              in the browser has none. {BROWSER_LOCAL_FILE_ADVICE}
            </Typography>
          </Alert>
        ) : null}
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
