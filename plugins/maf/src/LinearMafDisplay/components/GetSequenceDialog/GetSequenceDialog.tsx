import React, { useState } from 'react'

import { Dialog, ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import {
  Button,
  DialogActions,
  DialogContent,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import { useSequences } from '../../../util/useSequences'

import type { LinearMafDisplayModel } from '../../stateModel'

const useStyles = makeStyles()({
  dialogContent: {
    width: '80em',
  },
  textAreaInput: {
    fontFamily: 'monospace',
    whiteSpace: 'pre',
    overflowX: 'auto',
  },
  ml: {
    marginLeft: 10,
  },
})

const GetSequenceDialog = observer(function ({
  onClose,
  model,
  selectionCoords,
}: {
  onClose: () => void
  model: LinearMafDisplayModel
  selectionCoords?: {
    dragStartX: number
    dragEndX: number
  }
}) {
  const [showAllLetters, setShowAllLetters] = useState(true)
  const { classes } = useStyles()
  const { sequence, loading, error } = useSequences({
    model,
    selectionCoords,
    showAllLetters,
  })
  const sequenceTooLarge = sequence ? sequence.length > 1_000_000 : false

  return (
    <Dialog open onClose={onClose} title="Subsequence Data" maxWidth="xl">
      <DialogContent>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <ToggleButtonGroup
            value={showAllLetters}
            exclusive
            size="small"
            onChange={(_event, newDisplayMode) => {
              if (newDisplayMode !== null) {
                setShowAllLetters(newDisplayMode)
              }
            }}
          >
            <ToggleButton value={true}>Show All Letters</ToggleButton>
            <ToggleButton value={false}>Show Only Differences</ToggleButton>
          </ToggleButtonGroup>
          <div style={{ flexGrow: 1 }} />
          <Button
            variant="contained"
            color="primary"
            disabled={loading || !sequence}
            onClick={() => {
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              ;(async () => {
                try {
                  await navigator.clipboard.writeText(sequence)
                  getSession(model).notify(
                    'Sequence copied to clipboard',
                    'info',
                  )
                } catch (e) {
                  console.error(e)
                  getSession(model).notifyError(`${e}`, e)
                }
              })()
            }}
          >
            Copy to Clipboard
          </Button>
          <Button
            variant="contained"
            color="secondary"
            disabled={loading || !sequence}
            onClick={() => {
              try {
                const url = URL.createObjectURL(
                  new Blob([sequence], { type: 'text/plain' }),
                )

                // Create a temporary anchor element
                const a = document.createElement('a')
                a.href = url
                a.download = 'sequence.fasta'

                // Trigger the download
                document.body.append(a)
                a.click()

                // Clean up
                a.remove()
                URL.revokeObjectURL(url)
                getSession(model).notify('Sequence downloaded', 'info')
              } catch (e) {
                console.error(e)
                getSession(model).notifyError(`${e}`, e)
              }
            }}
          >
            Download
          </Button>
        </div>

        {error ? (
          <ErrorMessage error={error} />
        ) : (
          <>
            {loading ? <LoadingEllipses /> : null}
            <TextField
              variant="outlined"
              multiline
              minRows={5}
              maxRows={10}
              disabled={sequenceTooLarge}
              className={classes.dialogContent}
              fullWidth
              value={
                loading
                  ? 'Loading...'
                  : sequenceTooLarge
                    ? 'Reference sequence too large to display, use the download FASTA button'
                    : sequence
              }
              slotProps={{
                input: {
                  readOnly: true,
                  classes: {
                    input: classes.textAreaInput,
                  },
                },
              }}
            />
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button color="primary" variant="outlined" onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default GetSequenceDialog
