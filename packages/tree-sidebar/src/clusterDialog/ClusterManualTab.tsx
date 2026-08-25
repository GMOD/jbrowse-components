import { useState } from 'react'

import {
  CopyToClipboardButton,
  ErrorBanner,
  SubmitForm,
} from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { useFetch } from '@jbrowse/core/util/useFetch'
import {
  Button,
  FormControlLabel,
  Paper,
  Radio,
  RadioGroup,
  TextField,
} from '@mui/material'
import { observer } from 'mobx-react'

import ClusterProgress from '../ClusterProgress.tsx'
import { generateClusterRScript, matrixToTsv } from '../clusterRScript.ts'
import { parseClusterOrder } from '../clusterUtils.ts'
import ClusterAdvancedOptions from './ClusterAdvancedOptions.tsx'
import { resolveClusterRunArgs } from './clusterRunArgs.ts'

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
  const { saveAs } = await import('@jbrowse/core/util/FileSaver')
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
  // A rejected paste reports beside the box it came from, the way the auto tab
  // reports a failed run. It used to go to `session.notifyError`, i.e. a
  // snackbar somewhere else on screen while this dialog stayed open on the paste
  // that caused it — the one thing the message is asking the user to edit.
  const [pasteError, setPasteError] = useState<unknown>()

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
    status,
  } = useFetch(
    // The caller's key pieces go in NESTED rather than spread, keeping this a
    // fixed 2-tuple: `useFetch` hands the fetcher one argument per key element
    // and then the two handles, so a variable-length key leaves them unnameable.
    // It serializes the whole key, so nesting caches identically.
    view.initialized && matrixKey
      ? (['clusterMatrix', [...matrixKey, regionKey]] as const)
      : null,
    // The token makes Cancel — and a pan that re-keys the fetch — stop the
    // worker; the status sink drives the determinate row below.
    (_name, _key, stopToken, statusCallback) =>
      fetchMatrix(resolveClusterRunArgs(model, { stopToken, statusCallback })),
  )

  const script = matrix ? generateClusterRScript(matrix, clusterMethod) : ''
  const tsv = matrix ? matrixToTsv(matrix) : ''

  return (
    <SubmitForm
      submitText="Apply clustering"
      submitDisabled={!paste.trim()}
      onCancel={() => {
        handleClose()
      }}
      onSubmit={() => {
        try {
          setPasteError(undefined)
          // parseClusterOrder yields 1-based R indices; applyOrder takes
          // 0-based, and validates the order covers every row before
          // anything is applied
          applyOrder(parseClusterOrder(paste).map(idx => idx - 1))
          handleClose()
        } catch (e) {
          // a bad paste keeps the dialog open so the user can fix it
          console.error(e)
          setPasteError(e)
        }
      }}
    >
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
          <RadioGroup
            value={clusterMethod}
            onChange={(_event, next) => {
              setClusterMethod(next)
            }}
          >
            {Object.entries(methods).map(([key, label]) => (
              <FormControlLabel
                key={key}
                value={key}
                control={<Radio />}
                label={label}
              />
            ))}
          </RadioGroup>
          {advancedOptions}
        </ClusterAdvancedOptions>
        {loading ? (
          <ClusterProgress
            status={status}
            label={`Generating ${matrixLabel}`}
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
            // the message described the old paste, so it goes out with it
            setPasteError(undefined)
            setPaste(event.target.value)
          }}
          slotProps={{ input: { style: { fontFamily: 'Courier New' } } }}
        />
        {pasteError ? <ErrorBanner error={pasteError} /> : null}
      </Paper>
    </SubmitForm>
  )
})

export default ClusterManualTab
