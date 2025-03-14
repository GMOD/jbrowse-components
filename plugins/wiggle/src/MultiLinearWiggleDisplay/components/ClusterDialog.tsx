import { useEffect, useState } from 'react'

import { Dialog, ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import {
  getContainingView,
  getSession,
  isAbortException,
  useLocalStorage,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
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
import copy from 'copy-to-clipboard'
import { saveAs } from 'file-saver'
import { observer } from 'mobx-react'
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

const ClusterDialog = observer(function ({
  model,
  handleClose,
}: {
  model: {
    sources?: Source[]
    adapterConfig: AnyConfigurationModel
    setLayout: (arg: Source[]) => void
  }
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const view = getContainingView(model) as LinearGenomeViewModel
  const { dynamicBlocks, bpPerPx } = view
  const { rpcManager } = getSession(model)
  const { sources, adapterConfig } = model
  const sessionId = getRpcSessionId(model)
  const [ret, setRet] = useState<Record<string, any>>()
  const [error, setError] = useState<unknown>()
  const [paste, setPaste] = useState('')
  const [loading, setLoading] = useState(false)
  const [clusterMethod, setClusterMethod] = useLocalStorage(
    'cluster-clusterMethod',
    'single',
  )
  const [samplesPerPixel, setSamplesPerPixel] = useLocalStorage(
    'cluster-samplesPerPixel',
    '1',
  )

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        setError(undefined)
        setRet(undefined)
        setLoading(true)
        const r = +samplesPerPixel
        if (Number.isNaN(r)) {
          throw new Error('Samples per pixel is not a number')
        }
        if (r <= 0) {
          throw new Error('Samples per pixel must be greater than 0')
        }

        const adjustedBpPerPx = bpPerPx / r
        const ret = (await rpcManager.call(
          sessionId,
          'MultiWiggleGetScoreMatrix',
          {
            regions: dynamicBlocks.contentBlocks,
            sources,
            sessionId,
            adapterConfig,
            bpPerPx: adjustedBpPerPx,
          },
        )) as Record<string, { scores: number[] }>

        setRet(ret)
      } catch (e) {
        if (!isAbortException(e) && isAlive(model)) {
          console.error(e)
          setError(e)
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [
    model,
    adapterConfig,
    rpcManager,
    sources,
    dynamicBlocks,
    bpPerPx,
    sessionId,
    samplesPerPixel,
  ])

  const results = ret
    ? `try(library(fastcluster), silent=TRUE)
inputMatrix<-matrix(c(${Object.values(ret)
        .map(val => val.scores.join(','))
        .join(',\n')}
),nrow=${Object.values(ret).length},byrow=TRUE)
rownames(inputMatrix)<-c(${Object.keys(ret)
        .map(key => `'${key}'`)
        .join(',')})
resultClusters<-hclust(dist(inputMatrix), method='${clusterMethod}')
cat(resultClusters$order,sep='\\n')`
    : undefined

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

          <div>
            <Typography variant="subtitle2" gutterBottom>
              Clustering method:
            </Typography>
            <RadioGroup>
              <FormControlLabel
                control={
                  <Radio
                    checked={clusterMethod === 'single'}
                    onChange={() => {
                      setClusterMethod('single')
                    }}
                  />
                }
                label="Single linkage"
              />
              <FormControlLabel
                control={
                  <Radio
                    checked={clusterMethod === 'complete'}
                    onChange={() => {
                      setClusterMethod('complete')
                    }}
                  />
                }
                label="Complete linkage"
              />
            </RadioGroup>
          </div>
          <div>
            <TextField
              label="Samples per pixel"
              variant="outlined"
              size="small"
              value={samplesPerPixel}
              onChange={event => {
                setSamplesPerPixel(event.target.value)
              }}
              helperText="Higher values sample at sub-pixel resolution, fractional values sample only a single value for potentially multiple pixels"
            />
          </div>
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
          ) : loading ? (
            <LoadingEllipses variant="h6" title="Generating score matrix" />
          ) : error ? (
            <ErrorMessage error={error} />
          ) : null}
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
})

export default ClusterDialog
