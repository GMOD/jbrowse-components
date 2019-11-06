import Button from '@material-ui/core/Button'
import FormHelperText from '@material-ui/core/FormHelperText'
import Grid from '@material-ui/core/Grid'
import InputLabel from '@material-ui/core/InputLabel'
import { makeStyles } from '@material-ui/core/styles'
import TextField from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'
import ToggleButton from '@material-ui/lab/ToggleButton'
import ToggleButtonGroup from '@material-ui/lab/ToggleButtonGroup'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React from 'react'

const isElectron = !!window.electron

const useStyles = makeStyles(theme => {
  return {
    root: {
      position: 'relative',
      marginBottom: theme.spacing(1),
      background: 'white',
    },
  }
})

function FileLocationEditor(props) {
  const { slot } = props
  const { value } = slot

  const fileOrUrl = value && value.uri ? 'url' : 'file'

  const handleFileOrUrlChange = (event, newValue) => {
    if (newValue === 'url' && !(value && value.uri))
      slot.set({ uri: 'https://' })
    else if (newValue === 'file' && !(value && (value.localPath || value.blob)))
      slot.set({ localPath: '' })
    else slot.set(undefined)
  }
  return (
    <>
      <InputLabel shrink htmlFor="callback-editor">
        {slot.name}
      </InputLabel>
      <Grid container spacing={1} direction="row" alignItems="center">
        <Grid item>
          <ToggleButtonGroup
            value={fileOrUrl}
            exclusive
            size="small"
            onChange={handleFileOrUrlChange}
            aria-label="file or url picker"
          >
            <ToggleButton
              value="file"
              aria-label="local file"
              disabled={!isElectron}
            >
              File
            </ToggleButton>
            <ToggleButton value="url" aria-label="url">
              Url
            </ToggleButton>
          </ToggleButtonGroup>
        </Grid>
        <Grid item>
          {fileOrUrl === 'url' ? (
            <UrlChooser {...props} />
          ) : (
            <LocalFileChooser {...props} />
          )}
        </Grid>
      </Grid>
      <FormHelperText>{slot.description}</FormHelperText>
    </>
  )
}
FileLocationEditor.propTypes = {
  slot: ReactPropTypes.shape({
    value: ReactPropTypes.shape({
      uri: ReactPropTypes.string,
      localPath: ReactPropTypes.string,
      blob: ReactPropTypes.instanceOf(Blob),
    }),
    set: ReactPropTypes.func.isRequired,
    name: ReactPropTypes.string,
    description: ReactPropTypes.string,
  }).isRequired,
}

function UrlChooser({ slot }) {
  const { value } = slot
  const classes = useStyles()
  const handleChange = evt => {
    slot.set({ uri: evt.target.value })
  }
  return (
    <TextField
      className={classes.urlChooser}
      margin="dense"
      fullWidth
      defaultValue={value && value.uri}
      onChange={handleChange}
    />
  )
}
UrlChooser.propTypes = {
  slot: ReactPropTypes.shape({
    value: ReactPropTypes.shape({
      uri: ReactPropTypes.string,
      localPath: ReactPropTypes.string,
      blob: ReactPropTypes.instanceOf(Blob),
    }),
    set: ReactPropTypes.func.isRequired,
  }).isRequired,
}

function LocalFileChooser({ slot }) {
  const { value } = slot
  const handleChange = ({ target }) => {
    const file = target.files[0]
    if (file) {
      if (isElectron) slot.set({ localPath: file.path })
      else slot.set({ blob: file })
    }
  }

  const filename = value && ((value.blob && value.blob.name) || value.localPath)

  return (
    <div style={{ position: 'relative' }}>
      <Button size="small" variant="outlined" component="label">
        Choose File
        <input
          type="file"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            opacity: 0,
          }}
          onChange={handleChange}
        />
      </Button>
      <Typography
        style={{ marginLeft: '0.4rem' }}
        variant="body1"
        component="span"
      >
        {filename}
      </Typography>
    </div>
  )
}
LocalFileChooser.propTypes = {
  slot: ReactPropTypes.shape({
    value: ReactPropTypes.shape({
      uri: ReactPropTypes.string,
      localPath: ReactPropTypes.string,
      blob: ReactPropTypes.instanceOf(Blob),
    }),
    set: ReactPropTypes.func.isRequired,
  }).isRequired,
}

export default observer(FileLocationEditor)
