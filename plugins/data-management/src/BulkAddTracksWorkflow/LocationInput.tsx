import { FileDropZone } from '@jbrowse/core/ui'
import { fileToLocation, pluralize } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Button,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { BulkLocationsState } from './bulkLocations.ts'
import type { FileLocation } from '@jbrowse/core/util/types'

const useStyles = makeStyles()(theme => ({
  section: {
    marginTop: theme.spacing(2),
  },
}))

const DropZone = observer(function DropZone({
  localLocations,
  addLocalLocations,
  clearLocalLocations,
}: {
  localLocations: FileLocation[]
  addLocalLocations: (arg: FileLocation[]) => void
  clearLocalLocations: () => void
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.section}>
      <FileDropZone
        onDrop={accepted => {
          addLocalLocations(accepted.map(fileToLocation))
        }}
      />
      {localLocations.length > 0 ? (
        <Button
          size="small"
          onClick={() => {
            clearLocalLocations()
          }}
        >
          Clear {localLocations.length}{' '}
          {pluralize(localLocations.length, 'file')}
        </Button>
      ) : null}
    </div>
  )
})

const LocationInput = observer(function LocationInput({
  input,
}: {
  input: BulkLocationsState
}) {
  const {
    mode,
    setMode,
    text,
    setText,
    localLocations,
    addLocalLocations,
    clearLocalLocations,
  } = input
  const { classes } = useStyles()
  return (
    <>
      <RadioGroup
        row
        className={classes.section}
        value={mode}
        onChange={event => {
          setMode(event.target.value === 'local' ? 'local' : 'remote')
        }}
      >
        <FormControlLabel
          value="remote"
          control={<Radio />}
          label="Remote URLs"
        />
        <FormControlLabel
          value="local"
          control={<Radio />}
          label="Local files"
        />
      </RadioGroup>

      {mode === 'remote' ? (
        <TextField
          className={classes.section}
          label="File URLs (one per line)"
          placeholder={
            'https://example.com/a.bam\nhttps://example.com/a.bam.bai'
          }
          multiline
          minRows={8}
          maxRows={16}
          fullWidth
          variant="outlined"
          slotProps={{ htmlInput: { 'data-testid': 'bulk_track_urls' } }}
          value={text}
          onChange={event => {
            setText(event.target.value)
          }}
        />
      ) : (
        <DropZone
          localLocations={localLocations}
          addLocalLocations={addLocalLocations}
          clearLocalLocations={clearLocalLocations}
        />
      )}
    </>
  )
})

export default LocationInput
