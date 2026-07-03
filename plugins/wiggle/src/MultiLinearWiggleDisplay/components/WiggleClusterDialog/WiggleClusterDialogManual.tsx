import { useState } from 'react'

import {
  CopyToClipboardButton,
  ErrorBanner,
  LoadingEllipses,
} from '@jbrowse/core/ui'
import {
  getContainingView,
  getSession,
  useFetch,
  useLocalStorage,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import {
  buildClusteredLayout,
  generateClusterRScript,
  matrixToTsv,
  parseClusterOrder,
} from '@jbrowse/tree-sidebar'
import {
  Button,
  DialogActions,
  DialogContent,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import { parseSamplesPerPixel } from './parseSamplesPerPixel.ts'

import type { ReducedModel } from './types.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const WiggleClusterDialogManual = observer(function WiggleClusterDialogManual({
  model,
  handleClose,
  children,
}: {
  model: ReducedModel
  handleClose: () => void
  children: React.ReactNode
}) {
  const [paste, setPaste] = useState('')
  const [showAdvanced, setShowAdvanced] = useLocalStorage(
    'cluster-showAdvanced',
    false,
  )
  const [clusterMethod, setClusterMethod] = useState('single')
  const [samplesPerPixel, setSamplesPerPixel] = useLocalStorage(
    'cluster-samplesPerPixel',
    '1',
  )

  const view = getContainingView(model) as LinearGenomeViewModel
  const shouldFetch = view.initialized && !!model.sourcesWithoutLayout.length
  const {
    data: ret,
    error,
    isLoading: loading,
  } = useFetch(
    shouldFetch ? ['scoreMatrix', model, samplesPerPixel] : null,
    async () => {
      const { dynamicBlocks, bpPerPx } = view
      const { rpcManager } = getSession(model)
      const { sourcesWithoutLayout, adapterConfig } = model
      const sessionId = getRpcSessionId(model)
      return rpcManager.call(sessionId, 'MultiWiggleGetScoreMatrix', {
        regions: dynamicBlocks.contentBlocks,
        sources: sourcesWithoutLayout,
        adapterConfig,
        bpPerPx: bpPerPx / parseSamplesPerPixel(samplesPerPixel),
      })
    },
  )

  const results = ret ? generateClusterRScript(ret, clusterMethod) : undefined
  const resultsTsv = ret ? matrixToTsv(ret) : undefined

  return (
    <>
      <DialogContent>
        {children}
        <div style={{ marginTop: 50 }}>
          <div>
            <div
              style={{
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap',
                marginBottom: '16px',
              }}
            >
              <Button
                variant="contained"
                disabled={!results}
                onClick={async () => {
                  const { saveAs } = await import('@jbrowse/core/util')

                  saveAs(
                    new Blob([results || ''], {
                      type: 'text/plain;charset=utf-8',
                    }),
                    'cluster.R',
                  )
                }}
              >
                Download Rscript
              </Button>{' '}
              or{' '}
              <CopyToClipboardButton
                variant="contained"
                disabled={!results}
                value={() => results || ''}
              >
                Copy Rscript to clipboard
              </CopyToClipboardButton>{' '}
              or{' '}
              <Button
                variant="contained"
                disabled={!resultsTsv}
                onClick={async () => {
                  const { saveAs } = await import('@jbrowse/core/util')

                  saveAs(
                    new Blob([resultsTsv || ''], {
                      type: 'text/plain;charset=utf-8',
                    }),
                    'scores.tsv',
                  )
                }}
              >
                Download TSV
              </Button>
            </div>
            <div>
              <Button
                variant="contained"
                onClick={() => {
                  setShowAdvanced(!showAdvanced)
                }}
              >
                {showAdvanced
                  ? 'Hide advanced options'
                  : 'Show advanced options'}
              </Button>
            </div>
            {showAdvanced ? (
              <div>
                <Typography variant="h6">Advanced options</Typography>
                <RadioGroup>
                  {Object.entries({
                    single: 'Single',
                    complete: 'Complete',
                  }).map(([key, val]) => (
                    <FormControlLabel
                      key={key}
                      control={
                        <Radio
                          checked={clusterMethod === key}
                          onChange={() => {
                            setClusterMethod(key)
                          }}
                        />
                      }
                      label={val}
                    />
                  ))}
                </RadioGroup>
                <div style={{ marginTop: 20 }}>
                  <Typography>
                    By default this samples the data once per screen pixel
                    across the currently visible region.
                  </Typography>
                  <TextField
                    label="Samples per pixel (>1 for denser sampling, between 0-1 for sparser sampling)"
                    variant="outlined"
                    size="small"
                    value={samplesPerPixel}
                    onChange={event => {
                      setSamplesPerPixel(event.target.value)
                    }}
                  />
                </div>
              </div>
            ) : null}
            {results ? (
              <div />
            ) : loading ? (
              <LoadingEllipses variant="h6" message="Generating score matrix" />
            ) : error ? (
              <ErrorBanner error={error} />
            ) : null}
          </div>

          <div>
            <Typography
              variant="subtitle2"
              gutterBottom
              style={{ marginTop: '16px' }}
            >
              Clustering Results:
            </Typography>
            <TextField
              multiline
              fullWidth
              variant="outlined"
              placeholder="Paste results from Rscript here (sequence of numbers, one per line, specifying the new ordering)"
              rows={10}
              value={paste}
              onChange={event => {
                setPaste(event.target.value)
              }}
              slotProps={{
                input: {
                  style: { fontFamily: 'Courier New' },
                },
              }}
            />
          </div>
        </div>
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          disabled={!paste.trim()}
          onClick={() => {
            const { sourcesWithoutLayout } = model
            if (sourcesWithoutLayout.length) {
              try {
                // parseClusterOrder yields 1-based R indices; buildClusteredLayout
                // (shared with the auto dialog) expects 0-based.
                model.setLayout(
                  buildClusteredLayout(
                    sourcesWithoutLayout,
                    model.layout,
                    parseClusterOrder(paste).map(idx => idx - 1),
                  ),
                )
              } catch (e) {
                console.error(e)
                getSession(model).notifyError(`${e}`, e)
              }
            }
            handleClose()
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

export default WiggleClusterDialogManual
