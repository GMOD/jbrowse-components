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
import { session } from 'electron'
import crypto from 'crypto'

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
  oauthAccessTokenDropbox: string,
  queryUrl: string,
) => {
  if (!queryUrl) {
    return
  }
  const response = await fetch(
    'https://api.dropboxapi.com/2/sharing/get_shared_link_metadata',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${oauthAccessTokenDropbox}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: queryUrl,
      }),
    },
  )
  const metadata = await response.json()
  return metadata
}
const fetchTempLinkFromOauth = async (
  oauthAccessTokenDropbox: string,
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
        Authorization: `Bearer ${oauthAccessTokenDropbox}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: metadata.id }),
    },
  )

  const file = await fileResponse.json()
  return file.link
}

function getGoogleDriveIdFromUrl(url: string) {
  return url.match(/[-\w]{25,}/)
}

async function fetchDownloadURLFromOauth(
  oauthAccessTokenGoogle: string,
  queryUrl: string,
) {
  const urlId = getGoogleDriveIdFromUrl(queryUrl)
  const response = await fetch(
    `https://www.googleapis.com/drive/v2/files/${urlId}`,
    {
      headers: {
        Authorization: `Bearer ${oauthAccessTokenGoogle}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    },
  )

  const fileMetadata = await response.json()
  return fileMetadata
}

const FileLocationEditor = observer(
  (props: {
    location?: FileLocation
    setLocation: (param: FileLocation) => void
    setName?: (str: string) => void
    name?: string
    description?: string
    oauthAccessTokenDropbox?: string
    oauthAccessTokenGoogle?: string
    setCodeVerifierPKCE?: (param: string) => void
  }) => {
    const { location, name, description, setCodeVerifierPKCE } = props
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
                const base64Encode = (buf: Buffer) => {
                  return buf
                    .toString('base64')
                    .replace(/\+/g, '-')
                    .replace(/\//g, '_')
                    .replace(/=/g, '')
                }
                const codeVerifier = base64Encode(crypto.randomBytes(32))
                const sha256 = (str: string) => {
                  return crypto.createHash('sha256').update(str).digest()
                }
                const codeChallenge = base64Encode(sha256(codeVerifier))

                const data = {
                  client_id: 'wyngfdvw0ntnj5b',
                  redirect_uri: 'http://localhost:3000',
                  response_type: 'code',
                  code_challenge: codeChallenge,
                  code_challenge_method: 'S256',
                }

                if (setCodeVerifierPKCE) {
                  setCodeVerifierPKCE(codeVerifier)
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
  oauthAccessTokenDropbox?: string
  oauthAccessTokenGoogle?: string
}) => {
  const {
    location,
    setLocation,
    setName,
    oauthAccessTokenDropbox,
    oauthAccessTokenGoogle,
  } = props

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
        if (oauthAccessTokenDropbox && event.target.value.includes('dropbox')) {
          // need better conditional, oauthAccessTokenDropbox gets checked too late
          const metadata = await fetchMetadataFromOauth(
            oauthAccessTokenDropbox,
            event.target.value,
          )
          const oauthUri = await fetchTempLinkFromOauth(
            oauthAccessTokenDropbox,
            metadata,
          )
          console.log('dropbox success', oauthUri)
          setLocation({ uri: oauthUri })
          if (setName) {
            setName(metadata.name)
          }
        } else if (
          oauthAccessTokenGoogle &&
          event.target.value.includes('google')
        ) {
          const metadata = await fetchDownloadURLFromOauth(
            oauthAccessTokenGoogle,
            event.target.value,
          )
          console.log('google success', metadata)
          setLocation({ uri: metadata.downloadUrl })
          if (setName) {
            setName(metadata.title)
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
