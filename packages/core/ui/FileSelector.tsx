import Button from '@material-ui/core/Button'
import FormHelperText from '@material-ui/core/FormHelperText'
import Grid from '@material-ui/core/Grid'
import InputLabel from '@material-ui/core/InputLabel'
import TextField from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'
import ToggleButton from '@material-ui/lab/ToggleButton'
import ToggleButtonGroup from '@material-ui/lab/ToggleButtonGroup'
import { observer } from 'mobx-react'
import React, { MouseEvent } from 'react'
import {
  IFileLocation,
  IUriLocation,
  ILocalPathLocation,
  IBlobLocation,
} from '../mst-types'

const isElectron = !!window.electron

function isUriLocation(location: IFileLocation): location is IUriLocation {
  return (location as IUriLocation).uri !== undefined
}

function isLocalPathLocation(
  location: IFileLocation,
): location is ILocalPathLocation {
  return (location as ILocalPathLocation).localPath !== undefined
}

function isBlobLocation(location: IFileLocation): location is IBlobLocation {
  return (location as IBlobLocation).blob !== undefined
}

function FileLocationEditor(props: {
  location?: IFileLocation
  setLocation: Function
  name?: string
  description?: string
}) {
  const { location, setLocation, name, description } = props
  const fileOrUrl = location && isUriLocation(location) ? 'url' : 'file'

  const handleFileOrUrlChange = (
    event: React.MouseEvent<HTMLElement>,
    newValue: string | null,
  ) => {
    if (newValue === 'url') {
      setLocation({ uri: 'https://' })
    } else if (newValue === 'file') setLocation({ localPath: '' })
  }
  return (
    <>
      <InputLabel shrink htmlFor="callback-editor">
        {name}
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
      <FormHelperText>{description}</FormHelperText>
    </>
  )
}

function UrlChooser(props: {
  location?: IFileLocation
  setLocation: Function
}) {
  const { location, setLocation } = props
  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setLocation({ uri: event.target.value })
  }
  return (
    <TextField
      margin="dense"
      fullWidth
      defaultValue={location && isUriLocation(location) && location.uri}
      onChange={handleChange}
    />
  )
}

function LocalFileChooser(props: {
  location?: IFileLocation
  setLocation: Function
}) {
  const { location, setLocation } = props
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { target } = event
    const file = target && target.files && target.files[0]
    if (file) {
      if (isElectron) setLocation({ localPath: file.path })
      else setLocation({ blob: file })
    }
  }

  const filename =
    location &&
    ((isBlobLocation(location) && (location.blob as File).name) ||
      (isLocalPathLocation(location) && location.localPath))

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
      {filename ? (
        <Typography
          style={{ marginLeft: '0.4rem' }}
          variant="body1"
          component="span"
        >
          {filename}
        </Typography>
      ) : null}
    </div>
  )
}

export default observer(FileLocationEditor)
