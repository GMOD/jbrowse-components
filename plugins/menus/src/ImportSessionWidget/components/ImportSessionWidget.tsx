import React, { useState } from 'react'
import { Button, Paper, Typography, alpha } from '@mui/material'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { useDropzone } from 'react-dropzone'

// icons
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import ErrorIcon from '@mui/icons-material/Error'

const MAX_FILE_SIZE = 512 * 1024 ** 2 // 512 MiB

function styledBy(property: string, mapping: { [key: string]: string }) {
  return (props: { [key: string]: string }) => mapping[props[property]]
}

// @ts-expect-error
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
    borderColor: styledBy('isDragActive', {
      true: theme.palette.secondary.light,
      false: theme.palette.divider,
    }),
    borderStyle: 'dashed',
    backgroundColor: styledBy('isDragActive', {
      true: alpha(
        theme.palette.text.primary,
        theme.palette.action.hoverOpacity,
      ),
      false: theme.palette.background.default,
    }),
    outline: 'none',
    transition: 'border .24s ease-in-out',
    '&:focus': {
      borderColor: theme.palette.secondary.light,
    },
  },
  uploadIcon: {
    color: theme.palette.text.secondary,
  },
  rejectedFiles: {
    marginTop: theme.spacing(4),
  },
  listItem: {
    padding: theme.spacing(0, 4),
  },
  expandIcon: {
    color: theme.palette.tertiary.contrastText,
  },
  error: {
    margin: theme.spacing(2),
  },
  errorHeader: {
    background: theme.palette.error.light,
    color: theme.palette.error.contrastText,
    padding: theme.spacing(2),
    textAlign: 'center',
  },
  errorMessage: {
    padding: theme.spacing(2),
  },
}))

export function readBlobAsText(blob: Blob): Promise<string> {
  const a = new FileReader()
  return new Promise((resolve, reject) => {
    a.onload = e => {
      if (e.target) {
        resolve(e.target.result as string)
      } else {
        reject(new Error('unknown result reading blob from canvas'))
      }
    }
    a.readAsText(blob)
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ImportSession({ model }: { model: any }) {
  const [error, setError] = useState<unknown>()
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    // @ts-expect-error
    accept: 'application/json',
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    onDrop: async (acceptedFiles, rejectedFiles) => {
      try {
        if (rejectedFiles.length > 0) {
          throw new Error(
            `${rejectedFiles[0].errors.map(e => `${e}`).join(', ')}`,
          )
        } else {
          const sessionText = await readBlobAsText(acceptedFiles[0])
          getSession(model).setSession(JSON.parse(sessionText).session)
        }
      } catch (e) {
        console.error(e)
        setError(e)
      }
    },
  })

  // @ts-expect-error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { classes } = useStyles({ isDragActive }) as any

  return (
    <div className={classes.root}>
      <Paper className={classes.paper}>
        <div {...getRootProps({ className: classes.dropZone })}>
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
      {error ? (
        <Paper className={classes.error}>
          <div className={classes.errorHeader}>
            <ErrorIcon color="inherit" fontSize="large" />
            <div>
              <Typography variant="h6" color="inherit" align="center">
                Import error
              </Typography>
            </div>
          </div>
          <Typography className={classes.errorMessage}>{`${error}`}</Typography>
        </Paper>
      ) : null}
    </div>
  )
}

export default observer(ImportSession)
