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
    name?: string
    description?: string
  }) => {
    const { location, name, description, internetAccounts } = props
    const fileOrUrl = !location || isUriLocation(location) ? 'url' : 'file'
    const [fileOrUrlState, setFileOrUrlState] = useState(fileOrUrl)
    const [currentInternetAccount, setCurrentInternetAccount] = useState('')

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
  internetAccounts?: Account[]
}) => {
  const { location, setLocation, setName, internetAccounts } = props
  const [currentUrl, setCurrentUrl] = useState('')
  const [currentInternetAccount, setCurrentInternetAccount] = useState('')

  return (
    <>
      <TextField
        fullWidth
        inputProps={{ 'data-testid': 'urlInput' }}
        defaultValue={location && isUriLocation(location) ? location.uri : ''}
        onChange={event => {
          setCurrentUrl(event.target.value)
          setLocation({ uri: event.target.value })
        }}
      />
      {currentUrl !== '' && internetAccounts && (
        <div>
          <label htmlFor="internetAccountSelect">Select Internet Account</label>
          <Select
            id="internetAccountSelect"
            value={currentInternetAccount}
            onChange={event => {
              setCurrentInternetAccount(event.target.value as string)
              const account = internetAccounts.find(
                account => account.internetAccountId === event.target.value,
              )
              if (account && account.openLocation) {
                account.openLocation()
              }
            }}
          >
            {internetAccounts?.map(account => {
              if (account.handlesLocation()) {
                return (
                  <MenuItem
                    key={account.internetAccountId}
                    value={account.internetAccountId}
                  >
                    {account.name}
                  </MenuItem>
                )
              } else {
                return null
              }
            })}
          </Select>
        </div>
      )}
    </>
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
