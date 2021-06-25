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

interface Account {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}
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
    internetAccounts?: Account[]
    internetAccountConfigs?: Account[]
    name?: string
    description?: string
  }) => {
    const {
      location,
      name,
      description,
      internetAccounts,
      internetAccountConfigs,
    } = props
    const fileOrUrl = !location || isUriLocation(location) ? 'url' : 'file'
    const [mode, setMode] = useState('url')

    return (
      <>
        <InputLabel shrink htmlFor="callback-editor">
          {name}
        </InputLabel>
        <Grid container spacing={1} direction="row" alignItems="center">
          {internetAccounts?.map((account, idx) => {
            const currentConfig = internetAccountConfigs
              ? internetAccountConfigs[idx]
              : {}

            const existingToken = sessionStorage.getItem(
              `${currentConfig.internetAccountId}-token`,
            )
            return currentConfig.internetAccountId === mode ? (
              <Grid
                item
                style={{ width: '100%' }}
                key={currentConfig.internetAccountId}
              >
                <Button
                  color="primary"
                  variant="contained"
                  disabled={!!existingToken}
                  onClick={() => {
                    account.useEndpointForAuthorization(currentConfig)
                  }}
                  startIcon={
                    sessionStorage.getItem(
                      `${currentConfig.internetAccountId}-token`,
                    ) ? (
                      <CheckIcon />
                    ) : null
                  }
                >
                  {!existingToken
                    ? `Authorize ${currentConfig.name}`
                    : `Authorized ${currentConfig.name}`}
                </Button>
              </Grid>
            ) : null
          })}
          <Grid item>
            <Select
              value={mode}
              onChange={event => setMode(event.target.value as string)}
              style={{ paddingTop: 4 }}
            >
              <MenuItem value="file">File</MenuItem>
              <MenuItem value="url">URL</MenuItem>
              <MenuItem value="dropboxOAuth">Dropbox URL</MenuItem>
              <MenuItem value="googleOAuth">Google URL</MenuItem>
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
  oauthAccessToken?: string
  mode: string
}) => {
  const { location, setLocation, setName, oauthAccessToken, mode } = props

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
          oauthAccessToken &&
          mode === 'dropboxOAuth' &&
          event.target.value.includes('dropbox')
        ) {
          const metadata = await fetchMetadataFromOauth(
            oauthAccessToken,
            event.target.value,
          )
          if (metadata.error) {
            setBackgroundColor('#FFCCCC')
            return
          }
          const oauthUri = await fetchTempLinkFromOauth(
            oauthAccessToken,
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
          oauthAccessToken &&
          mode === 'googleOAuth' &&
          event.target.value.includes('google')
        ) {
          // need to fetch with Auth Headers
          const metadata = await fetchDownloadURLFromOauth(
            oauthAccessToken,
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
            authHeader: 'Authorization',
            authToken: `Bearer ${oauthAccessToken}`,
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
