import type { Dispatch, SetStateAction } from 'react'

import { FileDropZone } from '@jbrowse/core/ui'
import { fileToLocation } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Button,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { BulkLocationsState } from './useBulkLocations.ts'
import type { FileLocation } from '@jbrowse/core/util/types'

const useStyles = makeStyles()(theme => ({
  section: {
    marginTop: theme.spacing(2),
  },
}))

const DropZone = observer(function DropZone({
  localLocations,
  setLocalLocations,
}: {
  localLocations: FileLocation[]
  setLocalLocations: Dispatch<SetStateAction<FileLocation[]>>
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.section}>
      <FileDropZone
        onDrop={accepted => {
          setLocalLocations(prev => [...prev, ...accepted.map(fileToLocation)])
        }}
      />
      {localLocations.length > 0 ? (
        <Button
          variant="contained"
          size="small"
          onClick={() => {
            setLocalLocations([])
          }}
        >
          Clear {localLocations.length}{' '}
          {localLocations.length === 1 ? 'file' : 'files'}
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
  const { mode, setMode, text, setText, localLocations, setLocalLocations } =
    input
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
          minRows={4}
          fullWidth
          value={text}
          onChange={event => {
            setText(event.target.value)
          }}
        />
      ) : (
        <DropZone
          localLocations={localLocations}
          setLocalLocations={setLocalLocations}
        />
      )}
    </>
  )
})

export default LocationInput
