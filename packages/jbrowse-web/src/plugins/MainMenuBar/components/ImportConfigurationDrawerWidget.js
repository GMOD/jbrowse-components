import Button from '@material-ui/core/Button'
import Icon from '@material-ui/core/Icon'
import List from '@material-ui/core/List'
import ListItem from '@material-ui/core/ListItem'
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
}))

function ImportConfiguration() {
  const {
    acceptedFiles,
    getRootProps,
    getInputProps,
    isDragActive,
  } = useDropzone()
  const classes = useStyles({ isDragActive })

  console.log(acceptedFiles)

  const files = acceptedFiles.map(file => (
    <ListItem key={file.path}>
      <ListItemText
        primary={`${file.path} - ${file.size} bytes`}
        secondary={`${file.lastModifiedDate}`}
      />
    </ListItem>
  ))

  return (
    <Paper className={classes.root}>
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
        <Button color="secondary" variant="contained">
          Browse Files
        </Button>
      </div>
      <aside>
        <List subheader={<ListSubheader>Files</ListSubheader>}>{files}</List>
      </aside>
    </Paper>
  )
}

export default observer(ImportConfiguration)
