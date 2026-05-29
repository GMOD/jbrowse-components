import type { Dispatch, SetStateAction } from 'react'

import { fileToLocation } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import {
  Button,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
  alpha,
} from '@mui/material'
import { observer } from 'mobx-react'
import { useDropzone } from 'react-dropzone'

import type { InputMode } from './util.ts'
import type { FileLocation } from '@jbrowse/core/util/types'

const useStyles = makeStyles()(theme => ({
  section: {
    marginTop: theme.spacing(2),
  },
  dropZone: {
    textAlign: 'center',
    padding: theme.spacing(2),
    borderWidth: 2,
    borderRadius: 2,
    borderStyle: 'dashed',
    outline: 'none',
    transition: 'border .24s ease-in-out, background-color .24s ease-in-out',
  },
  dropZoneActive: {
    borderColor: theme.palette.secondary.light,
    backgroundColor: alpha(
      theme.palette.text.primary,
      theme.palette.action.hoverOpacity,
    ),
  },
  dropZoneInactive: {
    borderColor: theme.palette.divider,
    backgroundColor: theme.palette.background.default,
  },
  uploadIcon: {
    color: theme.palette.text.secondary,
  },
}))

const DropZone = observer(function DropZone({
  localLocations,
  setLocalLocations,
}: {
  localLocations: FileLocation[]
  setLocalLocations: Dispatch<SetStateAction<FileLocation[]>>
}) {
  const { classes, cx } = useStyles()
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: accepted => {
      setLocalLocations(prev => [...prev, ...accepted.map(fileToLocation)])
    },
  })
  return (
    <div className={classes.section}>
      <div
        {...getRootProps({
          className: cx(
            classes.dropZone,
            isDragActive ? classes.dropZoneActive : classes.dropZoneInactive,
          ),
        })}
      >
        <input {...getInputProps()} />
        <CloudUploadIcon className={classes.uploadIcon} fontSize="large" />
        <Typography color="text.secondary" align="center">
          Drag and drop files here, or click to browse
        </Typography>
      </div>
      {localLocations.length > 0 ? (
        <Button
          size="small"
          onClick={() => {
            setLocalLocations([])
          }}
        >
          Clear {localLocations.length} file(s)
        </Button>
      ) : null}
    </div>
  )
})

const LocationInput = observer(function LocationInput({
  mode,
  setMode,
  text,
  setText,
  localLocations,
  setLocalLocations,
}: {
  mode: InputMode
  setMode: (mode: InputMode) => void
  text: string
  setText: (text: string) => void
  localLocations: FileLocation[]
  setLocalLocations: Dispatch<SetStateAction<FileLocation[]>>
}) {
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
          placeholder={'https://example.com/a.bam\nhttps://example.com/a.bam.bai'}
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
