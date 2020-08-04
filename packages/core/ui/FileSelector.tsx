import Button from '@material-ui/core/Button'
import FormHelperText from '@material-ui/core/FormHelperText'
import Grid from '@material-ui/core/Grid'
import InputLabel from '@material-ui/core/InputLabel'
import TextField from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'
import ToggleButton from '@material-ui/lab/ToggleButton'
import ToggleButtonGroup from '@material-ui/lab/ToggleButtonGroup'
import { observer } from 'mobx-react'
import React, { useState } from 'react'
import {
  FileLocation,
  UriLocation,
  LocalPathLocation,
  BlobLocation,
} from '../util/types'

const isElectron = typeof window !== 'undefined' && Boolean(window.electron)

function isUriLocation(location: FileLocation): location is UriLocation {
  return 'uri' in location
}

function isLocalPathLocation(
  location: FileLocation,
): location is LocalPathLocation {
  return 'localPath' in location
}

function isBlobLocation(location: FileLocation): location is BlobLocation {
  return 'blob' in location
}

const FileLocationEditor = observer(
  (props: {
    location?: FileLocation
    setLocation: Function
    name?: string
    description?: string
  }) => {
    const { location, name, description } = props
    const fileOrUrl = location && isUriLocation(location) ? 'url' : 'file'
    const [fileOrUrlState, setFileOrUrlState] = useState(fileOrUrl)

    const handleFileOrUrlChange = (
      event: React.MouseEvent<HTMLElement>,
      newValue: string | null,
    ) => {
      if (newValue === 'url') {
        setFileOrUrlState('url')
      } else {
        setFileOrUrlState('file')
      }
    }
    return (
      <>
        <InputLabel shrink htmlFor="callback-editor">
          {name}
        </InputLabel>
        <Grid container spacing={1} direction="row" alignItems="center">
          <Grid item>
            <ToggleButtonGroup
              value={fileOrUrlState}
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
            {fileOrUrlState === 'url' ? (
              <UrlChooser {...props} />
            ) : (
              <LocalFileChooser {...props} />
            )}
          </Grid>
        </Grid>
        <FormHelperText>{description}</FormHelperText>
      </>
    )
  },
)

const UrlChooser = (props: {
  location?: FileLocation
  setLocation: Function
}) => {
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
      defaultValue={location && isUriLocation(location) ? location.uri : ''}
      onChange={handleChange}
    />
  )
}

const LocalFileChooser = observer(
  (props: { location?: FileLocation; setLocation: Function }) => {
    const { location, setLocation } = props
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const { target } = event
      const file = target && target.files && target.files[0]
      if (file) {
        if (isElectron) {
          setLocation({ localPath: file.path })
        } else {
          setLocation({ blob: file })
        }
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
  },
)

export default FileLocationEditor
