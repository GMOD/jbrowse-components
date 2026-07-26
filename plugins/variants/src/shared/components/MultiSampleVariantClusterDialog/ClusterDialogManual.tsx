import { useState } from 'react'

import {
  CopyToClipboardButton,
  ErrorBanner,
  LoadingEllipses,
} from '@jbrowse/core/ui'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { useLocalStorage } from '@jbrowse/core/util/hooks'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { useFetch } from '@jbrowse/core/util/useFetch'
import {
  generateClusterRScript,
  matrixToTsv,
  parseClusterOrder,
} from '@jbrowse/tree-sidebar'
import {
  Button,
  DialogActions,
  DialogContent,
  FormControlLabel,
  Paper,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import { applyClusterOrder } from '../../applyClusterOrder.ts'

import type { ReducedModel } from './types.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()({
  textAreaFont: {
    fontFamily: 'Courier New',
  },
})

const ClusterDialogManuals = observer(function ClusterDialogManuals({
  model,
  handleClose,
  children,
}: {
  model: ReducedModel
  handleClose: () => void
  children: React.ReactNode
}) {
  const { classes } = useStyles()
  const [paste, setPaste] = useState('')
  const [showAdvanced, setShowAdvanced] = useLocalStorage(
    'cluster-showAdvanced',
    false,
  )
  // 'average' (UPGMA) is what the built-in "Run clustering" uses, so the
  // default here reproduces it rather than quietly returning a different tree
  // from the same dialog.
  const [clusterMethod, setClusterMethod] = useState('average')

  const view = getContainingView(model) as LinearGenomeViewModel
  const {
    data: ret,
    error,
    isLoading: loading,
  } = useFetch(
    view.initialized ? ['genotypeMatrix', model] : null,
    async () => {
      const { rpcManager } = getSession(model)
      const {
        sourcesBase,
        minorAlleleFrequencyFilter,
        maxMissingnessFilter,
        filters,
        adapterConfig,
        renderingMode,
        sampleInfo,
      } = model
      const sessionId = getRpcSessionId(model)
      // Same rows the auto path clusters — the ones on screen. Both paths have
      // to agree, or the order pasted back here would be indexed against a
      // different sample set than "Run clustering" would have produced.
      return rpcManager.call(sessionId, 'MultiSampleVariantGetGenotypeMatrix', {
        regions: view.dynamicBlocks.contentBlocks,
        sources: sourcesBase ?? [],
        minorAlleleFrequencyFilter,
        maxMissingnessFilter,
        filters,
        adapterConfig,
        renderingMode,
        sampleInfo,
      })
    },
  )

  const results = ret ? generateClusterRScript(ret, clusterMethod) : undefined
  const resultsTsv = ret ? matrixToTsv(ret) : undefined

  return (
    <>
      <DialogContent>
        {children}
        <Paper style={{ padding: 16 }}>
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
                    'genotypes.tsv',
                  )
                }}
              >
                Download TSV
              </Button>
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
            </div>
            {showAdvanced ? (
              <div>
                <Typography variant="h6">Advanced options</Typography>
                <RadioGroup>
                  {Object.entries({
                    average: 'Average (UPGMA, matches "Run clustering")',
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
              </div>
            ) : null}
            {results ? (
              <div />
            ) : loading ? (
              <LoadingEllipses
                variant="h6"
                message="Generating genotype matrix"
              />
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
                  classes: {
                    input: classes.textAreaFont,
                  },
                },
              }}
            />
          </div>
        </Paper>
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          disabled={!paste.trim()}
          onClick={() => {
            const { sourcesBase, sampleInfo, renderingMode } = model
            if (sourcesBase) {
              try {
                // parseClusterOrder yields 1-based R indices; applyClusterOrder
                // (shared with the auto path) expects 0-based, and validates the
                // order covers every row before anything is applied.
                model.setLayout(
                  applyClusterOrder({
                    sourcesBase,
                    layout: model.layout,
                    order: parseClusterOrder(paste).map(idx => idx - 1),
                    renderingMode,
                    sampleInfo,
                  }),
                )
                // keep the dialog open on a bad paste so the user can fix it
                handleClose()
              } catch (e) {
                console.error(e)
                getSession(model).notifyError(`${e}`, e)
              }
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

export default ClusterDialogManuals
