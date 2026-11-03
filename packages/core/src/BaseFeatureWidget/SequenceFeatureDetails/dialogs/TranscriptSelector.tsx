import { FormControl, MenuItem, Select } from '@mui/material'
import { observer } from 'mobx-react'

import { makeStyles } from '../../../util/tss-react/index.ts'
import { featureLabel } from '../../BaseFeatureDetail/util.ts'

import type { TranscriptPick } from '../useTranscriptPick.ts'

const useStyles = makeStyles()({
  formControl: {
    margin: 0,
    marginRight: 4,
    minWidth: 0,
    maxWidth: '100%',
  },
})

// Only rendered when a container feature (a gene) has more than one
// transcript child. The details panel's Subfeatures header and the sequence
// toolbar each draw one, bound to the same pick, listed best first
const TranscriptSelector = observer(function TranscriptSelector({
  pick,
}: {
  pick: TranscriptPick
}) {
  const { classes } = useStyles()
  const { ranked, index, setIndex } = pick
  return (
    <FormControl className={classes.formControl}>
      <Select
        size="small"
        value={index}
        onChange={event => {
          setIndex(Number(event.target.value))
        }}
        aria-label="Transcript"
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
      </Select>
    </FormControl>
  )
})

export default TranscriptSelector
