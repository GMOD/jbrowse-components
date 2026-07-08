import { FormControl, MenuItem, Select } from '@mui/material'

import { makeStyles } from '../../../util/tss-react/index.ts'

import type { SimpleFeatureSerialized } from '../../../util/index.ts'

const useStyles = makeStyles()({
  formControl: {
    margin: 0,
    marginRight: 4,
  },
})

// Only rendered when a container feature (a gene) has more than one
// transcript child — picks which transcript's exon/CDS structure the
// sequence-type selector and body compute from.
export default function TranscriptSelector({
  transcripts,
  transcriptIndex,
  setTranscriptIndex,
}: {
  transcripts: SimpleFeatureSerialized[]
  transcriptIndex: number
  setTranscriptIndex: (index: number) => void
}) {
  const { classes } = useStyles()

  return (
    <FormControl className={classes.formControl}>
      <Select
        size="small"
        value={transcriptIndex}
        onChange={event => {
          setTranscriptIndex(Number(event.target.value))
        }}
        aria-label="Transcript"
      >
        {transcripts.map((transcript, idx) => (
          <MenuItem
            key={transcript.uniqueId}
            value={idx}
            data-testid={`transcript_${idx}`}
          >
            {`${transcript.name ?? transcript.id}`}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}
