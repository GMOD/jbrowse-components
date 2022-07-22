import React, { useState } from 'react'
import { Button, Paper, Typography, alpha } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { useDropzone } from 'react-dropzone'

// icons
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import ErrorIcon from '@mui/icons-material/Error'

function styledBy(property: string, mapping: { [key: string]: any }) {
  return (props: { [key: string]: string }) => mapping[props[property]]
}

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

function Dropzone({
  setAcceptedFiles,
}: {
  setAcceptedFiles: (arg: File[]) => void
}) {
  const [error, setError] = useState<unknown>()
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: true,
    onDrop: (acceptedFiles, rejectedFiles) => {
      try {
        if (rejectedFiles.length) {
          throw new Error(
            `${rejectedFiles[0].errors.map(e => e.message).join(', ')}`,
          )
        }
        setAcceptedFiles(acceptedFiles)
      } catch (e) {
        console.error(e)
        setError(e)
      }
    },
  })

  // @ts-ignore
  const { classes } = useStyles({ isDragActive }) as any

  return (
    <div className={classes.root}>
      <Paper
        className={classes.paper}
        style={{ background: isDragActive ? '#99fa' : undefined }}
      >
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

export default observer(Dropzone)
