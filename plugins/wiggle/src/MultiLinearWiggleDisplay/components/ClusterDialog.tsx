import { useEffect, useState } from 'react'

import { Dialog, ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import {
  getContainingView,
  getSession,
  isAbortException,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import {
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  FormControlLabel,
  TextField,
  Typography,
} from '@mui/material'
import copy from 'copy-to-clipboard'
import { saveAs } from 'file-saver'
import { isAlive } from 'mobx-state-tree'
import { makeStyles } from 'tss-react/mui'

import type { Source } from '../types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()(theme => ({
  textAreaFont: {
    fontFamily: 'Courier New',
  },
  mgap: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(4),
  },
}))

export default function ClusterDialog({
  model,
  handleClose,
}: {
  model: {
    sources?: Source[]
    minorAlleleFrequencyFilter?: number
    adapterConfig: AnyConfigurationModel
    setLayout: (arg: Source[]) => void
  }
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const [results, setResults] = useState<string>()
  const [error, setError] = useState<unknown>()
  const [paste, setPaste] = useState('')
  const [useCompleteMethod, setUseCompleteMethod] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        setError(undefined)
        const view = getContainingView(model) as LinearGenomeViewModel
        if (!view.initialized) {
          return
        }
        const { rpcManager } = getSession(model)
        const { sources, minorAlleleFrequencyFilter, adapterConfig } = model
        const sessionId = getRpcSessionId(model)
        const { bpPerPx } = view
        const ret = (await rpcManager.call(
          sessionId,
          'MultiWiggleGetScoreMatrix',
          {
            regions: view.dynamicBlocks.contentBlocks,
            sources,
            minorAlleleFrequencyFilter,
            sessionId,
            adapterConfig,
            bpPerPx,
          },
        )) as Record<string, { scores: number[] }>

        const entries = Object.values(ret)
        const keys = Object.keys(ret)
        const clusterMethod = useCompleteMethod ? 'complete' : 'single'
        const text = `try(library(fastcluster), silent=TRUE)
inputMatrix<-matrix(c(${entries.map(val => val.scores.join(',')).join(',\n')}
),nrow=${entries.length},byrow=TRUE)
rownames(inputMatrix)<-c(${keys.map(key => `'${key}'`).join(',')})
resultClusters<-hclust(dist(inputMatrix), method='${clusterMethod}')
cat(resultClusters$order,sep='\\n')`
        setResults(text)
      } catch (e) {
        if (!isAbortException(e) && isAlive(model)) {
          console.error(e)
          setError(e)
        }
      }
    })()
  }, [model, useCompleteMethod])

  return (
    <Dialog open title="Cluster by score" onClose={handleClose}>
      <DialogContent>
        <div className={classes.mgap}>
          <Typography>
            This page will produce an R script that will perform hierarchical
            clustering on the visible score data using `hclust`.
          </Typography>
          <Typography>
            You can then paste the results in this form to specify the row
            ordering.
          </Typography>
          {results ? (
            <div>
              <div>
                Step 1:{' '}
                <Button
                  variant="contained"
                  onClick={() => {
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
                <Button
                  variant="contained"
                  onClick={() => {
                    copy(results || '')
                  }}
                >
                  Copy Rscript to clipboard
                </Button>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={useCompleteMethod}
                      onChange={e => {
                        setUseCompleteMethod(e.target.checked)
                      }}
                    />
                  }
                  label="Use 'complete' linkage method instead of 'single'"
                />
                <div>
                  <TextField
                    multiline
                    fullWidth
                    variant="outlined"
                    placeholder="Step 2. Paste results from Rscript here (sequence of numbers, one per line, specifying the new ordering)"
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
              </div>
            </div>
          ) : (
            <LoadingEllipses variant="h6" title="Generating score matrix" />
          )}
          {error ? <ErrorMessage error={error} /> : null}
        </div>
      </DialogContent>
      <DialogActions>
        <Button
          disabled={!results}
          variant="contained"
          onClick={() => {
            const { sources } = model
            if (sources) {
              try {
                model.setLayout(
                  paste
                    .split('\n')
                    .map(t => t.trim())
                    .filter(f => !!f)
                    .map(r => +r)
                    .map(idx => {
                      const ret = sources[idx - 1]
                      if (!ret) {
                        throw new Error(`out of bounds at ${idx}`)
                      }
                      return ret
                    }),
                )
              } catch (e) {
                console.error(e)
                setError(e)
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
    </Dialog>
  )
}
