import Button from '@material-ui/core/Button'
import Icon from '@material-ui/core/Icon'
import List from '@material-ui/core/List'
import ListItem from '@material-ui/core/ListItem'
import ListItemIcon from '@material-ui/core/ListItemIcon'
import ListItemText from '@material-ui/core/ListItemText'
import ListSubheader from '@material-ui/core/ListSubheader'
import Paper from '@material-ui/core/Paper'
import { fade } from '@material-ui/core/styles/colorManipulator'
import Typography from '@material-ui/core/Typography'
import { makeStyles } from '@material-ui/styles'
import { observer } from 'mobx-react-lite'
import React, { useState } from 'react'
import { useDropzone } from 'react-dropzone'

function styledBy(property, mapping) {
  return props => mapping[props[property]]
}

const useStyles = makeStyles(theme => ({
  root: {
    margin: theme.spacing.unit,
  },
  paper: {
    display: 'flex',
    flexDirection: 'column',
  },
  dropZone: {
    textAlign: 'center',
    margin: theme.spacing.unit * 2,
    padding: theme.spacing.unit * 2,
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
    marginTop: theme.spacing.unit * 4,
  },
  errorMessage: {
    marginTop: theme.spacing.unit * 4,
    textAlign: 'center',
  },
}))

// Using this you can "await" the file text like a normal promise
// https://blog.shovonhasan.com/using-promises-with-filereader/
function readUploadedFileAsText(inputFile) {
  const temporaryFileReader = new FileReader()

  return new Promise((resolve, reject) => {
    temporaryFileReader.onerror = () => {
      temporaryFileReader.abort()
      reject(new Error(`problem reading input file "${inputFile.path}"`))
    }

    temporaryFileReader.onabort = () => {
      reject(new Error(`file reading was aborted: "${inputFile.path}"`))
    }

    temporaryFileReader.onload = () => {
      resolve(temporaryFileReader.result)
    }
    temporaryFileReader.readAsText(inputFile)
  })
}

function ImportConfiguration(props) {
  const [errorMessage, setErrorMessage] = useState('')
  const {
    acceptedFiles,
    rejectedFiles,
    getRootProps,
    getInputProps,
    isDragActive,
  } = useDropzone({
    accept: [
      'application/json',
      // 'application/x-yaml'
    ],
    onDrop: () => setErrorMessage(''),
  })
  const classes = useStyles({ isDragActive })

  const { addSessions } = props

  async function importConfigs() {
    const configs = []
    for (const file of acceptedFiles) {
      // const reader = new FileReader()

      configs.push(readUploadedFileAsText(file))
    }
    let unparsedConfigs
    try {
      unparsedConfigs = await Promise.all(configs)
    } catch (error) {
      console.error(error)
      setErrorMessage(`${error}`)
      return
    }
    const parsedConfigs = []
    for (let i = 0; i < unparsedConfigs.length; i += 1) {
      const unparsedConfig = unparsedConfigs[i]
      let config
      try {
        config = JSON.parse(unparsedConfig)
      } catch (error) {
        setErrorMessage(`Error parsing ${acceptedFiles[i].path}: ${error}`)
        return
      }
      parsedConfigs.push(config)
    }
    addSessions(parsedConfigs)
  }

  return (
    <div className={classes.root}>
      <Paper className={classes.paper}>
        <div {...getRootProps({ className: classes.dropZone })}>
          <input {...getInputProps()} />
          <Icon fontSize="large" className={classes.uploadIcon}>
            cloud_upload
          </Icon>
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
      {acceptedFiles.length ? (
        <>
          <List subheader={<ListSubheader>Files</ListSubheader>}>
            {acceptedFiles.map(file => (
              <ListItem key={file.path}>
                <ListItemIcon>
                  <Icon>check_circle</Icon>
                </ListItemIcon>
                <ListItemText
                  primary={file.path}
                  secondary={`${file.lastModifiedDate}`}
                />
              </ListItem>
            ))}
          </List>
          <Button
            color="primary"
            variant="contained"
            disabled={Boolean(errorMessage)}
            onClick={importConfigs}
          >
            Import
          </Button>
        </>
      ) : null}
      {rejectedFiles.length ? (
        <div className={classes.rejectedFiles}>
          <Typography color="error">
            Warning: some files were not of the correct type (JSON
            {/* or YAML */}
            )and will not be imported
          </Typography>
          <List>
            {rejectedFiles.map(file => (
              <ListItem key={file.path}>
                <ListItemIcon>
                  <Icon>error</Icon>
                </ListItemIcon>
                <ListItemText
                  primary={file.path}
                  secondary={`${file.lastModifiedDate}`}
                />
              </ListItem>
            ))}
          </List>
        </div>
      ) : null}
      {errorMessage ? (
        <div className={classes.errorMessage}>
          <Icon color="error" fontSize="large">
            error
          </Icon>
          <Typography color="error" align="center">
            {errorMessage}
          </Typography>
        </div>
      ) : null}
    </div>
  )
}

export default observer(ImportConfiguration)
