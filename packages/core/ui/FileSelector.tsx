import React, { useState, useEffect } from 'react'
import {
  Button,
  Grid,
  FormHelperText,
  InputLabel,
  TextField,
  Typography,
  Select,
  MenuItem,
  IconButton,
} from '@material-ui/core'
import CheckIcon from '@material-ui/icons/Check'
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
  if (!response.ok) {
    const errorText = await response.text()
    return { error: errorText }
  }
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
  if (!fileResponse.ok) {
    const errorText = await fileResponse.text()
    return { error: errorText }
  }
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
    const {
      location,
      name,
      description,
      oauthAccessTokenDropbox,
      oauthAccessTokenGoogle,
      setCodeVerifierPKCE,
    } = props
    const fileOrUrl = !location || isUriLocation(location) ? 'url' : 'file'
    const [mode, setMode] = useState('url')

    return (
      <>
        <InputLabel shrink htmlFor="callback-editor">
          {name}
        </InputLabel>
        <Grid container spacing={1} direction="row" alignItems="center">
          {mode === 'dropbox_url' && (
            <Grid item style={{ width: '100%' }}>
              <Button
                color="primary"
                variant="contained"
                disabled={!!oauthAccessTokenDropbox}
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
                startIcon={oauthAccessTokenDropbox ? <CheckIcon /> : null}
              >
                {!oauthAccessTokenDropbox
                  ? `Authorize Dropbox`
                  : `Dropbox Authorized`}
              </Button>
            </Grid>
          )}
          {mode === 'google_url' && (
            <Grid item style={{ width: '100%' }}>
              <Button
                color="primary"
                variant="contained"
                disabled={!!oauthAccessTokenGoogle}
                onClick={() => {
                  const data = {
                    client_id:
                      '20156747540-bes2tq75790efrskmb5pa3hupujgenb2.apps.googleusercontent.com',
                    redirect_uri: 'http://localhost:3000',
                    response_type: 'token',
                    scope: 'https://www.googleapis.com/auth/drive.readonly',
                  }

                  const params = Object.entries(data)
                    .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
                    .join('&')

                  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
                  const options = `width=500,height=600,left=0,top=0`
                  return window.open(url, 'Authorization', options)
                }}
                startIcon={oauthAccessTokenGoogle ? <CheckIcon /> : null}
              >
                {!oauthAccessTokenDropbox
                  ? `Authorize Google`
                  : `Google Authorized`}
              </Button>
            </Grid>
          )}
          <Grid item>
            <Select
              value={mode}
              onChange={event => setMode(event.target.value as string)}
              style={{ paddingTop: 4 }}
            >
              <MenuItem value="file">File</MenuItem>
              <MenuItem value="url">URL</MenuItem>
              <MenuItem value="dropbox_url">Dropbox URL</MenuItem>
              <MenuItem value="google_url">Google URL</MenuItem>
            </Select>
          </Grid>
          <Grid item>
            {mode === 'file' ? (
              <LocalFileChooser {...props} />
            ) : (
              <UrlChooser {...props} mode={mode} />
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
  mode: string
}) => {
  const {
    location,
    setLocation,
    setName,
    oauthAccessTokenDropbox,
    oauthAccessTokenGoogle,
    mode,
  } = props

  const [backgroundColor, setBackgroundColor] = useState('none')

  return (
    <TextField
      fullWidth
      inputProps={{ 'data-testid': 'urlInput' }}
      defaultValue={location && isUriLocation(location) ? location.uri : ''}
      style={{ background: backgroundColor }}
      onChange={async event => {
        setBackgroundColor('none')
        if (
          oauthAccessTokenDropbox &&
          mode === 'dropbox_url' &&
          event.target.value.includes('dropbox')
        ) {
          const metadata = await fetchMetadataFromOauth(
            oauthAccessTokenDropbox,
            event.target.value,
          )
          if (metadata.error) {
            setBackgroundColor('#FFCCCC')
            return
          }
          const oauthUri = await fetchTempLinkFromOauth(
            oauthAccessTokenDropbox,
            metadata,
          )
          if (oauthUri.error) {
            setBackgroundColor('#FFCCCC')
            return
          }
          setBackgroundColor('#E6F4EA')
          setLocation({ uri: oauthUri })
          if (setName) {
            setName(metadata.name)
          }
        } else if (
          oauthAccessTokenGoogle &&
          mode === 'google_url' &&
          event.target.value.includes('google')
        ) {
          // need to fetch with Auth Headers
          const metadata = await fetchDownloadURLFromOauth(
            oauthAccessTokenGoogle,
            event.target.value,
          )
          if (metadata.error) {
            setBackgroundColor('#FFCCCC')
            return
          }
          setBackgroundColor('#E6F4EA')
          console.log(metadata)
          setLocation({
            uri: metadata.downloadUrl,
            authToken: `Bearer ${oauthAccessTokenGoogle}`,
          })
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
