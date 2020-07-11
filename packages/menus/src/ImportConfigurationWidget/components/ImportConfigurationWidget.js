import { getSession } from '@gmod/jbrowse-core/util'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import Button from '@material-ui/core/Button'
import ExpansionPanel from '@material-ui/core/ExpansionPanel'
import ExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails'
import ExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary'
import IconButton from '@material-ui/core/IconButton'
import List from '@material-ui/core/List'
import ListItem from '@material-ui/core/ListItem'
import ListItemIcon from '@material-ui/core/ListItemIcon'
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction'
import ListSubheader from '@material-ui/core/ListSubheader'
import Paper from '@material-ui/core/Paper'
import { makeStyles } from '@material-ui/core/styles'
import { fade } from '@material-ui/core/styles/colorManipulator'
import TextField from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import React, { useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import CloudUploadIcon from '@material-ui/icons/CloudUpload'
import ErrorIcon from '@material-ui/icons/Error'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'
import CheckCircleIcon from '@material-ui/icons/CheckCircle'
import DeleteIcon from '@material-ui/icons/Delete'

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
  errorMessage: {
    marginTop: theme.spacing(4),
    textAlign: 'center',
  },
  listItem: {
    padding: theme.spacing(0, 4),
  },
  expandIcon: {
    color: '#FFFFFF',
  },
}))

function ImportConfiguration(props) {
  const [errorMessage, setErrorMessage] = useState('')
  const [acceptedFilesParsed, setAcceptedFilesParsed] = useState([])
  const {
    acceptedFiles,
    getRootProps,
    getInputProps,
    isDragActive,
  } = useDropzone({
    onDrop: () => setErrorMessage(''),
  })
  useEffect(() => {
    async function getConfigs() {
      const newConfigs = []
      for (const file of acceptedFiles) {
        let config
        if (
          !['application/json' /* , 'application/x-yaml' */].includes(file.type)
        )
          config = { error: `File is not in JSON format: ${file.path}` }
        else if (file.size > 512 * 1024 ** 2)
          config = {
            error: `File is too large (${file.size} bytes, max of 512 MiB): ${file.path}`,
          }
        else {
          const fileHandle = openLocation({ blob: file })
          let configContents
          try {
            // eslint-disable-next-line no-await-in-loop
            configContents = await fileHandle.readFile('utf8')
          } catch (error) {
            console.error(error)
            config = { error: `Problem opening file ${file.path}: ${error}` }
          }
          if (configContents)
            try {
              config = JSON.parse(configContents)
            } catch (error) {
              console.error(error)
              config = { error: `Error parsing ${file.path}: ${error}` }
            }
          if (!config.error) {
            if (!config.defaultSession) config.defaultSession = {}
            if (!config.defaultSession.name)
              config.defaultSession.name = `Imported Config ${file.path}`
          }
        }
        newConfigs.push(config)
      }

      setAcceptedFilesParsed(
        acceptedFiles.map((file, idx) => {
          file.config = newConfigs[idx]
          return file
        }),
      )
    }

    getConfigs()
  }, [acceptedFiles])
  const classes = useStyles({ isDragActive })

  const { addSessions, setActiveSession, model } = props
  const session = getSession(model)

  async function importConfigs() {
    try {
      await addSessions(acceptedFilesParsed.map(file => file.config))
      setActiveSession(acceptedFilesParsed[0].config.defaultSession.name)
      session.hideWidget(model)
    } catch (error) {
      setErrorMessage(`${error}`)
    }
  }

  function updateConfigName(newName, idx) {
    setAcceptedFilesParsed(
      acceptedFilesParsed.map((file, fileIdx) => {
        if (idx === fileIdx) file.config.defaultSession.name = newName
        return file
      }),
    )
  }

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
      {acceptedFilesParsed.length ? (
        <>
          <List subheader={<ListSubheader>Files</ListSubheader>}>
            {acceptedFilesParsed.map((file, idx) => (
              <ListItem key={file.path}>
                <ListItemIcon>
                  {file.config.error ? <ErrorIcon /> : <CheckCircleIcon />}
                </ListItemIcon>
                {file.config.error ? (
                  <Typography color="error" className={classes.listItem}>
                    {file.config.error}
                  </Typography>
                ) : (
                  <TextField
                    value={file.config.defaultSession.name}
                    fullWidth
                    helperText={file.path}
                    onChange={event => {
                      updateConfigName(event.target.value, idx)
                    }}
                    className={classes.listItem}
                  />
                )}
                <ListItemSecondaryAction>
                  <IconButton
                    onClick={() => {
                      acceptedFilesParsed.splice(idx, 1)
                      if (acceptedFilesParsed.length === 0) setErrorMessage('')
                      setAcceptedFilesParsed(acceptedFilesParsed.map(e => e))
                    }}
                    color="secondary"
                  >
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
          <Button
            color="primary"
            variant="contained"
            disabled={Boolean(
              errorMessage ||
                acceptedFilesParsed.some(file => file.config.error),
            )}
            onClick={importConfigs}
          >
            Import
          </Button>
        </>
      ) : null}
      {errorMessage ? (
        <>
          <div className={classes.errorMessage}>
            <ErrorIcon color="error" fontSize="large" />
          </div>
          <div>
            <ExpansionPanel style={{ marginTop: 4 }}>
              <ExpansionPanelSummary
                expandIcon={<ExpandMoreIcon className={classes.expandIcon} />}
              >
                <Typography color="error" align="center">
                  {acceptedFilesParsed.length === 1
                    ? 'Import error: File does not appear to be a valid configuration'
                    : 'Import error: One of the files is likely an invalid configuration. Try importing them one at a time.'}
                </Typography>
              </ExpansionPanelSummary>
              <ExpansionPanelDetails>
                <div style={{ overflowX: 'auto' }}>
                  <Typography color="error" align="center">
                    {errorMessage}
                  </Typography>
                </div>
              </ExpansionPanelDetails>
            </ExpansionPanel>
          </div>
        </>
      ) : null}
    </div>
  )
}

ImportConfiguration.propTypes = {
  addSessions: PropTypes.func.isRequired,
  setActiveSession: PropTypes.func.isRequired,
  model: MobxPropTypes.observableObject.isRequired,
}

export default observer(ImportConfiguration)
