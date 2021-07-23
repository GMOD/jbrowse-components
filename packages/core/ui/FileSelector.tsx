import React, { useState } from 'react'
import {
  Button,
  Grid,
  FormHelperText,
  InputLabel,
  TextField,
  Typography,
  Select,
  MenuItem,
} from '@material-ui/core'
import { ToggleButtonGroup, ToggleButton } from '@material-ui/lab'
import { observer } from 'mobx-react'
import { isElectron } from '../util'
import {
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

const FileLocationEditor = observer(
  (props: {
    location?: FileLocation
    setLocation: (param: FileLocation) => void
    setName?: (str: string) => void
    internetAccounts?: Account[]
    name?: string
    description?: string
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
  internetAccounts?: Account[]
}) => {
  const { location, setLocation, internetAccounts } = props
  const [currentUrl, setCurrentUrl] = useState('')
  const [currentInternetAccount, setCurrentInternetAccount] = useState(
    'autoDetect',
  )

  const autoDetectInternetAccount = (urlInput: string) => {
    let detectedId = ''
    try {
      new URL(urlInput)
    } catch (error) {
      // skip
      return detectedId
    }

    internetAccounts?.forEach(account => {
      if (account.handlesLocation({ uri: urlInput })) {
        detectedId = account.accountConfig.internetAccountId
      }
    })

    return detectedId
  }

  const findInternetAccountHeader = (id: string) => {
    const account = internetAccounts.find(account => {
      return account.accountConfig.internetAccountId === id
    })

    return account.accountConfig.authHeader
  }
  return (
    <>
      <TextField
        fullWidth
        inputProps={{ 'data-testid': 'urlInput' }}
        defaultValue={location && isUriLocation(location) ? location.uri : ''}
        onChange={event => {
          setCurrentUrl(event.target.value)
          if (event.target.value === '') {
            setCurrentInternetAccount('')
          }
          if (currentInternetAccount) {
            const internetAccountId =
              currentInternetAccount === 'autoDetect'
                ? autoDetectInternetAccount(event.target.value)
                : currentInternetAccount

            const customHeader = findInternetAccountHeader(internetAccountId)
            setLocation({
              uri: event.target.value,
              baseAuthUri: event.target.value,
              internetAccountId: internetAccountId,
              authHeader: customHeader || 'Authorization',
            })
          } else {
            setLocation({ uri: event.target.value })
          }
        }}
      />
      {currentUrl !== '' && internetAccounts && (
        <div>
          <label htmlFor="internetAccountSelect">Select Internet Account</label>
          <Select
            id="internetAccountSelect"
            value={currentInternetAccount}
            style={{ margin: 5 }}
            onChange={event => {
              let internetAccountId = event.target.value
              setCurrentInternetAccount(event.target.value as string)
              if (event.target.value === 'autoDetect') {
                internetAccountId = autoDetectInternetAccount(currentUrl)
              }
              const customHeader = findInternetAccountHeader(internetAccountId)

              setLocation({
                uri: currentUrl,
                baseAuthUri: currentUrl,
                internetAccountId: internetAccountId,
                authHeader: customHeader || 'Authorization',
              })
            }}
            displayEmpty
          >
            <MenuItem value="">None</MenuItem>
            <MenuItem value="autoDetect">
              Auto Detect: {autoDetectInternetAccount(currentUrl)}
            </MenuItem>
            {internetAccounts?.map(account => {
              try {
                new URL(currentUrl)
                return (
                  <MenuItem
                    key={account.internetAccountId}
                    value={account.internetAccountId}
                  >
                    {account.name}
                  </MenuItem>
                )
              } catch (e) {
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
