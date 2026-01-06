import { useState } from 'react'

import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import { Button, Paper, Typography, alpha } from '@mui/material'
import { observer } from 'mobx-react'
import { useDropzone } from 'react-dropzone'

import ImportError from './ImportError.tsx'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

const MAX_FILE_SIZE = 512 * 1024 ** 2 // 512 MiB

const useStyles = makeStyles()(theme => ({
  root: {
    margin: theme.spacing(1),
  },
  paper: {
    display: 'flex',
    flexDirection: 'column',
  },
  dropZone: {
    textAlign: 'center',
    margin: theme.spacing(2),
    padding: theme.spacing(2),
    borderWidth: 2,
    borderRadius: 2,
    borderStyle: 'dashed',
    outline: 'none',
    transition: 'border .24s ease-in-out, background-color .24s ease-in-out',
    '&:focus': {
      borderColor: theme.palette.secondary.light,
    },
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

const ImportSessionWidget = observer(function ImportSessionWidget({
  model,
}: {
  model: IAnyStateTreeNode
}) {
  const [error, setError] = useState<unknown>()
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    // @ts-expect-error
    accept: 'application/json',
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    onDrop: async (acceptedFiles, rejectedFiles) => {
      try {
        if (rejectedFiles.length > 0) {
          throw new Error(rejectedFiles[0]!.errors.map(e => `${e}`).join(', '))
        }
        const sessionText = await acceptedFiles[0]!.text()
        getSession(model).setSession?.(JSON.parse(sessionText).session)
      } catch (e) {
        console.error(e)
        setError(e)
      }
    },
  })

  const { classes, cx } = useStyles()

  return (
    <div className={classes.root}>
      <Paper className={classes.paper}>
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
          <Typography color="textSecondary" align="center" variant="body1">
            Drag and drop files here
          </Typography>
          <Typography color="textSecondary" align="center" variant="body2">
            or
          </Typography>
          <Button color="primary" variant="contained">
            Browse Files
          </Button>
        </div>
      </Paper>
      {error ? <ImportError error={error} /> : null}
    </div>
  )
})

export default ImportSessionWidget
