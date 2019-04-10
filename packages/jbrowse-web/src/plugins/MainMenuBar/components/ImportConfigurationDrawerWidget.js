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
import React from 'react'
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
}))

function ImportConfiguration(props) {
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
  })
  const classes = useStyles({ isDragActive })

  const { addSession } = props

  function importConfigs() {
    acceptedFiles.forEach(file => {
      const reader = new FileReader()

      reader.onabort = () =>
        console.error('file reading was aborted', file.path)
      reader.onerror = () => console.error('file reading has failed', file.path)
      reader.onload = () => {
        let config
        try {
          config = JSON.parse(reader.result)
        } catch (error) {
          console.error('error parsing file', file.path, error)
        }
        try {
          addSession(config)
        } catch (error) {
          console.error('config does not appear to be valid', file.path, error)
        }
      }
      reader.readAsBinaryString(file)
    })
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
          <Button color="primary" variant="contained" onClick={importConfigs}>
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
                  primary={`${file.path} - ${file.size} bytes`}
                  secondary={`${file.lastModifiedDate}`}
                />
              </ListItem>
            ))}
          </List>
        </div>
      ) : null}
    </div>
  )
}

export default observer(ImportConfiguration)
