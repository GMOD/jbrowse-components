import { useEffect, useState } from 'react'

import { ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
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
  Paper,
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

import type { ReducedModel } from './types'
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

const ClusterDialogManuals = observer(function ({
  model,
  handleClose,
  children,
  samplesPerPixel,
}: {
  model: ReducedModel
  handleClose: () => void
  children: React.ReactNode
  samplesPerPixel: number
}) {
  const { classes } = useStyles()
  const view = getContainingView(model) as LinearGenomeViewModel
  const { dynamicBlocks, bpPerPx } = view
  const { rpcManager } = getSession(model)
  const { sources, adapterConfig } = model
  const sessionId = getRpcSessionId(model)
  const [paste, setPaste] = useState('')
  const [ret, setRet] = useState<Record<string, number[]>>()
  const [error, setError] = useState<unknown>()
  const [loading, setLoading] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [clusterMethod, setClusterMethod] = useLocalStorage(
    'cluster-clusterMethod',
    'single',
  )

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        setError(undefined)
        setRet(undefined)
        setLoading(true)

        const ret = (await rpcManager.call(
          sessionId,
          'MultiWiggleGetScoreMatrix',
          {
            regions: dynamicBlocks.contentBlocks,
            sources,
            sessionId,
            adapterConfig,
            bpPerPx: bpPerPx / samplesPerPixel,
          },
        )) as Record<string, number[]>

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
    rpcManager,
    adapterConfig,
    bpPerPx,
    dynamicBlocks.contentBlocks,
    sessionId,
    samplesPerPixel,
    sources,
  ])

  const results = ret
    ? `inputMatrix<-matrix(c(${Object.values(ret)
        .map(val => val.join(','))
        .join(',\n')}
),nrow=${Object.values(ret).length},byrow=TRUE)
rownames(inputMatrix)<-c(${Object.keys(ret)
        .map(key => `'${key}'`)
        .join(',')})
resultClusters<-hclust(dist(inputMatrix), method='${clusterMethod}')
cat(resultClusters$order,sep='\\n')`
    : undefined

  const resultsTsv = ret
    ? Object.entries(ret)
        .map(([key, val]) => [key, ...val].join('\t'))
        .join('\n')
    : undefined

  return (
    <>
      <DialogContent>
        {children}
        <Paper style={{ padding: 16 }}>
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
            </Button>{' '}
            or{' '}
            <Button
              variant="contained"
              onClick={() => {
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
                </div>
              ) : null}
            </div>
            {results ? (
              <div />
            ) : loading ? (
              <LoadingEllipses variant="h6" title="Generating score matrix" />
            ) : error ? (
              <ErrorMessage error={error} />
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

export default ClusterDialogManuals
