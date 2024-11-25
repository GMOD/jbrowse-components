import React, { useState } from 'react'
import { getSession } from '@jbrowse/core/util'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import { Button, Paper, Typography, alpha } from '@mui/material'
import { observer } from 'mobx-react'
import { useDropzone } from 'react-dropzone'
import { makeStyles } from 'tss-react/mui'

// icons

// locals
import ImportError from './ImportError'
import type { IAnyStateTreeNode } from 'mobx-state-tree'

const MAX_FILE_SIZE = 512 * 1024 ** 2 // 512 MiB

function styledBy(property: string, mapping: Record<string, string>) {
  return (props: Record<string, string>) => mapping[props[property]!]
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
}))

const ImportSessionWidget = observer(function ({
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

  // @ts-expect-error

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
      {error ? <ImportError error={error} /> : null}
    </div>
  )
})

export default ImportSessionWidget
