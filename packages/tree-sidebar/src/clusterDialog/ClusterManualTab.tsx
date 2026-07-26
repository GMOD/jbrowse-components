import { useState } from 'react'

import {
  CopyToClipboardButton,
  ErrorBanner,
  LoadingEllipses,
} from '@jbrowse/core/ui'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { useFetch } from '@jbrowse/core/util/useFetch'
import {
  Button,
  DialogActions,
  DialogContent,
  FormControlLabel,
  Paper,
  Radio,
  RadioGroup,
  TextField,
} from '@mui/material'
import { observer } from 'mobx-react'

import { generateClusterRScript, matrixToTsv } from '../clusterRScript.ts'
import { parseClusterOrder } from '../clusterUtils.ts'
import ClusterAdvancedOptions from './ClusterAdvancedOptions.tsx'

import type { ClusterDialogProps } from './types.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// @gmod/hclust is average-linkage only (equivalent to R's
// hclust(method="average")), so 'average' is what the "Run clustering" button
// produces and the default here reproduces it rather than quietly returning a
// different tree from the same dialog.
const methods = {
  average: 'Average (UPGMA, matches "Run clustering")',
  single: 'Single',
  complete: 'Complete',
}

async function download(text: string, filename: string) {
  const { saveAs } = await import('@jbrowse/core/util')
  saveAs(new Blob([text], { type: 'text/plain;charset=utf-8' }), filename)
}

// "Download R script": export the matrix, run hclust in R, paste the leaf order
// back. The display contributes the matrix fetch and how an order is applied.
const ClusterManualTab = observer(function ClusterManualTab({
  model,
  handleClose,
  matrixLabel,
  tsvFilename,
  matrixKey,
  fetchMatrix,
  applyOrder,
  advancedOptions,
  children,
}: ClusterDialogProps & { children: React.ReactNode }) {
  const [paste, setPaste] = useState('')
  const [clusterMethod, setClusterMethod] = useState('average')

  // The matrix is computed over the visible region at the current resolution, so
  // the key has to track both — otherwise panning or zooming while the dialog is
  // open leaves the script and TSV describing rows that are no longer on screen.
  const view = getContainingView(model) as LinearGenomeViewModel
  const regionKey = JSON.stringify({
    blocks: view.dynamicBlocks.contentBlocks.map(b => [
      b.refName,
      b.start,
      b.end,
    ]),
    bpPerPx: view.bpPerPx,
  })
  const {
    data: matrix,
    error,
    isLoading: loading,
  } = useFetch(
    view.initialized && matrixKey ? [...matrixKey, regionKey] : null,
    fetchMatrix,
  )

  const script = matrix ? generateClusterRScript(matrix, clusterMethod) : ''
  const tsv = matrix ? matrixToTsv(matrix) : ''

  return (
    <>
      <DialogContent>
        {children}
        <Paper style={{ padding: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              disabled={!script}
              onClick={() => {
                void download(script, 'cluster.R')
              }}
            >
              Download Rscript
            </Button>
            or{' '}
            <CopyToClipboardButton
              variant="contained"
              disabled={!script}
              value={() => script}
            >
              Copy Rscript to clipboard
            </CopyToClipboardButton>
            or{' '}
            <Button
              variant="contained"
              disabled={!tsv}
              onClick={() => {
                void download(tsv, tsvFilename)
              }}
            >
              Download TSV
            </Button>
          </div>
          <ClusterAdvancedOptions>
            <RadioGroup>
              {Object.entries(methods).map(([key, label]) => (
                <FormControlLabel
                  key={key}
                  value={key}
                  checked={clusterMethod === key}
                  control={<Radio />}
                  label={label}
                  onChange={() => {
                    setClusterMethod(key)
                  }}
                />
              ))}
            </RadioGroup>
            {advancedOptions}
          </ClusterAdvancedOptions>
          {loading ? (
            <LoadingEllipses
              variant="h6"
              message={`Generating ${matrixLabel}`}
            />
          ) : error ? (
            <ErrorBanner error={error} />
          ) : null}
          <TextField
            variant="outlined"
            multiline
            minRows={5}
            maxRows={10}
            fullWidth
            label="Paste result of the R script here"
            value={paste}
            onChange={event => {
              setPaste(event.target.value)
            }}
            slotProps={{ input: { style: { fontFamily: 'Courier New' } } }}
          />
        </Paper>
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          disabled={!paste.trim()}
          onClick={() => {
            try {
              // parseClusterOrder yields 1-based R indices; applyOrder takes
              // 0-based, and validates the order covers every row before
              // anything is applied
              applyOrder(parseClusterOrder(paste).map(idx => idx - 1))
              handleClose()
            } catch (e) {
              // a bad paste keeps the dialog open so the user can fix it
              console.error(e)
              getSession(model).notifyError(`${e}`, e)
            }
          }}
        >
          Apply clustering
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => {
            handleClose()
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </>
  )
})

export default ClusterManualTab
