import { fileToLocation } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import { Typography, alpha } from '@mui/material'
import { observer } from 'mobx-react'
import { useDropzone } from 'react-dropzone'

import type { TrackItem } from './util.ts'

const useStyles = makeStyles()(theme => ({
  dropZone: {
    textAlign: 'center',
    padding: theme.spacing(4),
    borderWidth: 2,
    borderRadius: 2,
    borderStyle: 'dashed',
    outline: 'none',
    cursor: 'pointer',
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
  addTracks,
}: {
  addTracks: (items: TrackItem[]) => void
}) {
  const { classes, cx } = useStyles()
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: accepted => {
      addTracks(
        accepted.map(file => ({
          type: 'BigWigAdapter',
          bigWigLocation: fileToLocation(file),
          source: file.name,
        })),
      )
    },
  })
  return (
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
  )
})

export default DropZone
