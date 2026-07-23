import { useState } from 'react'

import { isPalindromic, parseMotifList } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Button,
  DialogActions,
  DialogContent,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import StrandCheckboxes from './StrandCheckboxes.tsx'
import { DEFAULT_MOTIFS } from './defaultMotifs.ts'
import { addReferenceScanTrack } from './searchModes.ts'

import type { SequenceSearchModeProps } from './searchModes.ts'
import type { ParsedMotif } from '@jbrowse/core/util'

// Reconstructs the single-line REBASE text parseMotifList produced a motif
// from, so each motif can be sent to its own track's adapter unmodified.
function motifToLine(motif: ParsedMotif) {
  const site =
    motif.cutOffset === undefined
      ? motif.site
      : motif.site.slice(0, motif.cutOffset) +
        '^' +
        motif.site.slice(motif.cutOffset)
  return `${motif.name}\t${site}`
}

const useStyles = makeStyles()({
  dialogContent: {
    width: '34em',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
})

const MotifListPanel = observer(function MotifListPanel({
  model,
  handleClose,
}: SequenceSearchModeProps) {
  const { classes } = useStyles()
  const [text, setText] = useState(DEFAULT_MOTIFS)
  const [searchForward, setSearchForward] = useState(true)
  const [searchReverse, setSearchReverse] = useState(true)

  const { motifs, errors } = parseMotifList(text)
  // strand choice only means something for motifs that read differently on the
  // two strands; most restriction sites are palindromes, which always match both
  const hasStrandedMotif = motifs.some(m => !isPalindromic(m.site))
  const strandValid = !hasStrandedMotif || searchForward || searchReverse
  const canSubmit = motifs.length > 0 && errors.length === 0 && strandValid

  function handleSubmitCombined() {
    addReferenceScanTrack(model, {
      trackId: `motif_search_${Date.now()}`,
      name:
        motifs.length === 1
          ? `Motif ${motifs[0]!.name}`
          : `Motif search (${motifs.length} motifs)`,
      adapter: {
        type: 'MotifListAdapter',
        motifs: text,
        searchForward,
        searchReverse,
      },
    })
    handleClose()
  }

  function handleSubmitSeparate() {
    const now = Date.now()
    for (const [idx, motif] of motifs.entries()) {
      addReferenceScanTrack(model, {
        trackId: `motif_search_${now}_${idx}`,
        name: `Motif ${motif.name}`,
        adapter: {
          type: 'MotifListAdapter',
          motifs: motifToLine(motif),
          searchForward,
          searchReverse,
        },
      })
    }
    handleClose()
  }

  return (
    <>
      <DialogContent className={classes.dialogContent}>
        <TextField
          multiline
          fullWidth
          rows={12}
          variant="outlined"
          label="Motifs"
          value={text}
          onChange={event => {
            setText(event.target.value)
          }}
          slotProps={{ htmlInput: { style: { fontFamily: 'monospace' } } }}
        />
        {errors.length > 0 ? (
          <Typography color="error" variant="body2">
            {errors.map(e => `Line ${e.line}: ${e.message}`).join('\n')}
          </Typography>
        ) : (
          <Typography variant="body2" color="textSecondary">
            {motifs.length === 0
              ? 'Add at least one motif'
              : `${motifs.length} motif${motifs.length === 1 ? '' : 's'}`}
          </Typography>
        )}
        {hasStrandedMotif ? (
          <StrandCheckboxes
            searchForward={searchForward}
            searchReverse={searchReverse}
            setSearchForward={setSearchForward}
            setSearchReverse={setSearchReverse}
          />
        ) : motifs.length > 0 ? (
          <Typography variant="body2" color="textSecondary">
            All motifs are palindromic, so each match covers both strands.
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            handleSubmitCombined()
          }}
          disabled={!canSubmit}
          variant="contained"
          color="primary"
        >
          Launch as one track
        </Button>
        {motifs.length > 1 ? (
          <Button
            onClick={() => {
              handleSubmitSeparate()
            }}
            disabled={!canSubmit}
            variant="contained"
            color="primary"
          >
            Launch one track per motif
          </Button>
        ) : null}
        <Button
          onClick={() => {
            handleClose()
          }}
          variant="contained"
          color="secondary"
        >
          Cancel
        </Button>
      </DialogActions>
    </>
  )
})

export default MotifListPanel
