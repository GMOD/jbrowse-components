import React, { useState } from 'react'
import {
  Button,
  Grid,
  FormHelperText,
  InputLabel,
  TextField,
  Typography,
} from '@material-ui/core'
import { ToggleButtonGroup, ToggleButton } from '@material-ui/lab'
import { observer } from 'mobx-react'
import { isElectron } from '../util'
import {
  PreLocalPathLocation,
  PreUriLocation,
  PreBlobLocation,
  PreFileLocation,
  LocalPathLocation,
  UriLocation,
  FileLocation,
  BlobLocation,
} from '../util/types'
import { getBlob, storeBlobLocation } from '../util/tracks'

function isUriLocation(location: FileLocation): location is UriLocation {
  return 'uri' in location
}

function isLocalPathLocation(
  location: FileLocation,
): location is LocalPathLocation {
  return 'localPath' in location
}

function isBlobLocation(location: FileLocation): location is BlobLocation {
  return 'blobId' in location
}

const fetchMetadataFromOauth = async (
  oauthAccessToken: string,
  shareLink: string,
) => {
  if (!shareLink) {
    return
  }
  const response = await fetch(
    'https://api.dropboxapi.com/2/sharing/get_shared_link_metadata',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${oauthAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: shareLink,
      }),
    },
  )
  const metadata = await response.json()
  return metadata
}
const fetchTempLinkFromOauth = async (
  oauthAccessToken: string,
  metadata: {
    id: string
  },
) => {
  if (!metadata) {
    return
  }
  const fileResponse = await fetch(
    'https://api.dropboxapi.com/2/files/get_temporary_link',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${oauthAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: metadata.id }),
    },
  )

  const file = await fileResponse.json()
  return file.link
}

const FileLocationEditor = observer(
  (props: {
    location?: FileLocation
    setLocation: (param: FileLocation) => void
    setName?: (str: string) => void
    name?: string
    description?: string
    oauthAccessToken?: string
  }) => {
    const { location, name, description } = props
    const fileOrUrl = !location || isUriLocation(location) ? 'url' : 'file'
    const [fileOrUrlState, setFileOrUrlState] = useState(fileOrUrl)

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
              onChange={(_, newValue) => {
                if (newValue === 'url') {
                  setFileOrUrlState('url')
                } else {
                  setFileOrUrlState('file')
                }
              }}
              aria-label="file or url picker"
            >
              <ToggleButton value="file" aria-label="local file">
                File
              </ToggleButton>
              <ToggleButton value="url" aria-label="url">
                URL
              </ToggleButton>
            </ToggleButtonGroup>
            <Button
              onClick={() => {
                const data = {
                  client_id: 'wyngfdvw0ntnj5b',
                  redirect_uri: 'http://localhost:3000',
                  response_type: 'code',
                }

                const params = Object.entries(data)
                  .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
                  .join('&')

                const url = `https://www.dropbox.com/oauth2/authorize?${params}`
                const options = `width=500,height=600,left=0,top=0`
                return window.open(url, 'Authorization', options)
              }}
            >
              Dropbox
            </Button>
            <Button
              onClick={() => {
                const data = {
                  client_id:
                    '20156747540-bes2tq75790efrskmb5pa3hupujgenb2.apps.googleusercontent.com',
                  redirect_uri: 'http://localhost:3000',
                  response_type: 'token',
                  scope: 'https://www.googleapis.com/auth/drive',
                }

                const params = Object.entries(data)
                  .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
                  .join('&')

                const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
                const options = `width=500,height=600,left=0,top=0`
                return window.open(url, 'Authorization', options)
              }}
            >
              Google
            </Button>
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
  setName?: Function
  oauthAccessToken?: string
}) => {
  const { location, setLocation, setName, oauthAccessToken } = props

  function isOauth() {
    if (
      location &&
      isUriLocation(location) &&
      (location.uri.includes('dropbox') || location.uri.includes('google'))
    ) {
      return true
    }
    return false
  }

  return (
    <TextField
      fullWidth
      inputProps={{ 'data-testid': 'urlInput' }}
      defaultValue={location && isUriLocation(location) ? location.uri : ''}
      onChange={async event => {
        if (oauthAccessToken) {
          // need better conditional, oauthAccessToken gets checked too late
          const metadata = await fetchMetadataFromOauth(
            oauthAccessToken,
            event.target.value,
          )
          const oauthUri = await fetchTempLinkFromOauth(
            oauthAccessToken,
            metadata,
          )
          setLocation({ uri: oauthUri })
          if (setName) {
            setName(metadata.name)
          }
        } else {
          setLocation({ uri: event.target.value })
        }
      }}
    />
  )
}

const LocalFileChooser = observer(
  (props: { location?: FileLocation; setLocation: Function }) => {
    const { location, setLocation } = props

    const filename =
      location &&
      ((isBlobLocation(location) && location.name) ||
        (isLocalPathLocation(location) && location.localPath))

    const needToReload =
      location && isBlobLocation(location) && !getBlob(location.blobId)

    return (
      <div style={{ position: 'relative' }}>
        <Button variant="outlined" component="label">
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
            onChange={({ target }) => {
              const file = target && target.files && target.files[0]
              if (file) {
                if (isElectron) {
                  setLocation({ localPath: file.path })
                } else {
                  setLocation(storeBlobLocation({ blob: file }))
                }
              }
            }}
          />
        </Button>
        {filename ? (
          <>
            <Typography
              style={{ marginLeft: '0.4rem' }}
              variant="body1"
              component="span"
            >
              {filename}
            </Typography>
            {needToReload ? (
              <Typography color="error">(need to reload)</Typography>
            ) : null}
          </>
        ) : null}
      </div>
    )
  },
)

export default FileLocationEditor
