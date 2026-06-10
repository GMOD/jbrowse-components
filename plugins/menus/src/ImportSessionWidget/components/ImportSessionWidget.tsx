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
  paper: {
    margin: theme.spacing(1),
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
    accept: { 'application/json': ['.json'] },
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    onDrop: async (acceptedFiles, rejectedFiles) => {
      try {
        setError(undefined)
        if (rejectedFiles.length > 0) {
          throw new Error(
            rejectedFiles[0]!.errors.map(e => e.message).join(', '),
          )
        }
        const sessionText = await acceptedFiles[0]!.text()
        const parsed: unknown = JSON.parse(sessionText)
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('File does not contain a JSON object')
        }
        // session exports wrap the session under a top-level "session" key;
        // fall back to treating the whole object as the session
        const session = 'session' in parsed ? parsed.session : parsed
        if (!session || typeof session !== 'object') {
          throw new Error(
            'No session found in file. Expected a JBrowse session export (a JSON file with a top-level "session" key).',
          )
        }
        getSession(model).setSession?.(
          session as { name: string; [key: string]: unknown },
        )
      } catch (e) {
        console.error(e)
        setError(e)
      }
    },
  })

  const { classes, cx } = useStyles()

  return (
    <>
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
          <Typography color="text.secondary" align="center" variant="body1">
            Drag and drop a session file here
          </Typography>
          <Typography color="text.secondary" align="center" variant="body2">
            or
          </Typography>
          <Button color="primary" variant="contained">
            Browse Files
          </Button>
        </div>
      </Paper>
      {error ? <ImportError error={error} /> : null}
    </>
  )
})

export default ImportSessionWidget
