import React, { useState } from 'react'
import { getSession } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { storeBlobLocation } from '@jbrowse/core/util/tracks'
import { Button, Paper, Typography, makeStyles } from '@material-ui/core'
import { fade } from '@material-ui/core/styles/colorManipulator'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import { useDropzone } from 'react-dropzone'

// icons
import CloudUploadIcon from '@material-ui/icons/CloudUpload'
import ErrorIcon from '@material-ui/icons/Error'

const MAX_FILE_SIZE = 512 * 1024 ** 2 // 512 MiB

function styledBy(property, mapping) {
  return props => mapping[props[property]]
}

const useStyles = makeStyles(theme => ({
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
      true: fade(theme.palette.text.primary, theme.palette.action.hoverOpacity),
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
    color: '#FFFFFF',
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

function ImportSession(props) {
  const [errorMessage, setErrorMessage] = useState('')
  const { model } = props
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: 'application/json',
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    onDrop: async (acceptedFiles, rejectedFiles) => {
      if (rejectedFiles.length) {
        if (acceptedFiles.length || rejectedFiles.length > 1) {
          setErrorMessage('Only one session at a time may be imported')
        } else if (rejectedFiles[0].size > MAX_FILE_SIZE) {
          setErrorMessage(
            `File size is too large (${Math.round(
              rejectedFiles[0].size / 1024 ** 2,
            )} MiB), max size is ${MAX_FILE_SIZE / 1024 ** 2} MiB`,
          )
        } else if (rejectedFiles[0].type !== 'application/json') {
          setErrorMessage('File does not appear to be JSON')
        } else {
          setErrorMessage('Unknown file import error')
        }
        return
      }
      const [file] = acceptedFiles
      const fileHandle = openLocation(storeBlobLocation({ blob: file }))
      let sessionText
      try {
        sessionText = await fileHandle.readFile('utf8')
      } catch (error) {
        console.error(error)
        setErrorMessage(`Problem opening file ${file.path}: ${error}`)
        return
      }
      let sessionContents
      try {
        sessionContents = JSON.parse(sessionText).session
      } catch (error) {
        console.error(error)
        sessionContents = { error: `Error parsing ${file.path}: ${error}` }
      }
      const session = getSession(model)
      try {
        session.setSession(sessionContents)
      } catch (error) {
        console.error(error)
        setErrorMessage(`Error activating session: ${error} `)
      }
    },
  })
  const classes = useStyles({ isDragActive })

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
      {errorMessage ? (
        <Paper className={classes.error}>
          <div className={classes.errorHeader}>
            <ErrorIcon color="inherit" fontSize="large" />
            <div>
              <Typography variant="h6" color="inherit" align="center">
                Import error
              </Typography>
            </div>
          </div>
          <Typography className={classes.errorMessage}>
            {errorMessage}
          </Typography>
        </Paper>
      ) : null}
    </div>
  )
}

ImportSession.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
}

export default observer(ImportSession)
