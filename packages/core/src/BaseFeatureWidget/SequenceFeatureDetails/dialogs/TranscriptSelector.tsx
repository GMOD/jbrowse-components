import { MenuItem, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import { makeStyles } from '../../../util/tss-react/index.ts'
import { featureLabel } from '../../BaseFeatureDetail/util.ts'

import type { TranscriptPick } from '../useTranscriptPick.ts'

const useStyles = makeStyles()({
  field: {
    margin: 0,
    marginRight: 4,
    minWidth: 0,
    maxWidth: '100%',
  },
})

// Only rendered when a container feature (a gene) has more than one
// transcript child. The details panel's Subfeatures section and the sequence
// toolbar each draw one, bound to the same pick, listed best first
const TranscriptSelector = observer(function TranscriptSelector({
  pick,
  fullWidth = false,
}: {
  pick: TranscriptPick
  fullWidth?: boolean
}) {
  const { classes } = useStyles()
  const { ranked, index, setIndex } = pick
  const rank = ranked.findIndex(entry => entry.index === index) + 1
  return (
    <TextField
      select
      variant="outlined"
      size="small"
      fullWidth={fullWidth}
      className={classes.field}
      label={`Transcript (${rank} of ${ranked.length})`}
      value={index}
      onChange={event => {
        setIndex(Number(event.target.value))
      }}
      data-testid="transcript-select"
    >
      {ranked.map(({ transcript, index: idx }) => (
        <MenuItem
          key={transcript.uniqueId}
          value={idx}
          data-testid={`transcript_${idx}`}
        >
          {featureLabel(transcript) ?? `Transcript ${idx + 1}`}
        </MenuItem>
      ))}
    </TextField>
  )
})

export default TranscriptSelector
