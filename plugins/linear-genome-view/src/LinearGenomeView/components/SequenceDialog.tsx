import React, { useEffect, useMemo, useState } from 'react'

import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Container,
  Typography,
  Divider,
  IconButton,
  TextField,
  makeStyles,
} from '@material-ui/core'
import { observer } from 'mobx-react'
import { saveAs } from 'file-saver'
import { getConf } from '@jbrowse/core/configuration'
import copy from 'copy-to-clipboard'
import { getSession, Feature, Region } from '@jbrowse/core/util'
import { formatSeqFasta } from '@jbrowse/core/util/formatFastaStrings'

// icons
import { ContentCopy as ContentCopyIcon } from '@jbrowse/core/ui/Icons'
import CloseIcon from '@material-ui/icons/Close'
import GetAppIcon from '@material-ui/icons/GetApp'

// locals
import { LinearGenomeViewModel } from '..'

const useStyles = makeStyles(theme => ({
  loadingMessage: {
    padding: theme.spacing(5),
  },
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
  dialogContent: {
    width: '80em',
  },
  textAreaFont: {
    fontFamily: 'Courier New',
  },
}))

type LGV = LinearGenomeViewModel

/**
 * Fetches and returns a list features for a given list of regions
 */
async function fetchSequence(
  model: LGV,
  regions: Region[],
  signal?: AbortSignal,
) {
  const session = getSession(model)
  const { leftOffset, rightOffset } = model

  if (!leftOffset || !rightOffset) {
    throw new Error('no offsets on model to use for range')
  }

  if (leftOffset.assemblyName !== rightOffset.assemblyName) {
    throw new Error('not able to fetch sequences from multiple assemblies')
  }
  const { rpcManager, assemblyManager } = session
  const assemblyName = leftOffset.assemblyName || rightOffset.assemblyName || ''
  const assembly = assemblyManager.get(assemblyName)
  if (!assembly) {
    throw new Error(`assembly ${assemblyName} not found`)
  }
  const adapterConfig = getConf(assembly, ['sequence', 'adapter'])

  const sessionId = 'getSequence'
  return rpcManager.call(sessionId, 'CoreGetFeatures', {
    adapterConfig,
    regions,
    sessionId,
    signal,
  }) as Promise<Feature[]>
}

function SequenceDialog({
  model,
  handleClose,
}: {
  model: LinearGenomeViewModel
  handleClose: () => void
}) {
  const classes = useStyles()
  const session = getSession(model)
  const [error, setError] = useState<unknown>()
  const [sequence, setSequence] = useState<string>()
  const loading = Boolean(sequence === undefined)
  const { leftOffset, rightOffset } = model

  // avoid infinite looping of useEffect
  // random note: the current selected region can't be a computed because it
  // uses action on base1dview even though it's on the ephemeral base1dview
  const regionsSelected = useMemo(
    () => model.getSelectedRegions(leftOffset, rightOffset),
    [model, leftOffset, rightOffset],
  )

  useEffect(() => {
    let active = true
    const controller = new AbortController()

    ;(async () => {
      try {
        if (regionsSelected.length > 0) {
          const chunks = await fetchSequence(
            model,
            regionsSelected,
            controller.signal,
          )
          if (active) {
            const toL = (n: number) => n.toLocaleString('en-US')
            setSequence(
              formatSeqFasta(
                chunks
                  .filter(f => !!f)
                  .map(chunk => {
                    const seq = chunk.get('seq')
                    const refName = chunk.get('refName')
                    const start = chunk.get('start')
                    const end = chunk.get('end')
                    const loc = `${refName}:${start + 1}-${end}`
                    const slen = seq.length
                    const flen = end - start
                    if (slen !== flen) {
                      throw new Error(
                        `${loc} returned ${toL(
                          slen,
                        )}bp, but should have returned ${toL(flen)}bp`,
                      )
                    }
                    return { header: loc, seq }
                  }),
              ),
            )
          }
        } else {
          throw new Error('Selected region is out of bounds')
        }
      } catch (e) {
        console.error(e)
        if (active) {
          setError(e)
        }
      }
    })()

    return () => {
      controller.abort()
      active = false
    }
  }, [model, session, regionsSelected, setSequence])

  const sequenceTooLarge = sequence ? sequence.length > 1_000_000 : false

  return (
    <Dialog maxWidth="xl" open onClose={handleClose}>
      <DialogTitle>
        Reference sequence
        {handleClose ? (
          <IconButton
            className={classes.closeButton}
            onClick={() => {
              handleClose()
              model.setOffsets(undefined, undefined)
            }}
          >
            <CloseIcon />
          </IconButton>
        ) : null}
      </DialogTitle>
      <Divider />

      <DialogContent>
        {error ? <Typography color="error">{`${error}`}</Typography> : null}
        {loading && !error ? (
          <Container>
            Retrieving reference sequence...
            <CircularProgress
              style={{
                marginLeft: 10,
              }}
              size={20}
              disableShrink
            />
          </Container>
        ) : null}
        <TextField
          variant="outlined"
          multiline
          minRows={5}
          disabled={sequenceTooLarge}
          className={classes.dialogContent}
          fullWidth
          value={
            sequenceTooLarge
              ? 'Reference sequence too large to display, use the download FASTA button'
              : sequence
          }
          InputProps={{
            readOnly: true,
            classes: {
              input: classes.textAreaFont,
            },
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            copy(sequence || '')
            session.notify('Copied to clipboard', 'success')
          }}
          disabled={loading || !!error || sequenceTooLarge}
          color="primary"
          startIcon={<ContentCopyIcon />}
        >
          Copy to clipboard
        </Button>
        <Button
          onClick={() => {
            const seqFastaFile = new Blob([sequence || ''], {
              type: 'text/x-fasta;charset=utf-8',
            })
            saveAs(seqFastaFile, 'jbrowse_ref_seq.fa')
          }}
          disabled={loading || !!error}
          color="primary"
          startIcon={<GetAppIcon />}
        >
          Download FASTA
        </Button>
        <Button onClick={handleClose} color="primary" autoFocus>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default observer(SequenceDialog)
