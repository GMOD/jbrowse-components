import React, { useState } from 'react'
import {
  Button,
  Grid,
  FormHelperText,
  InputLabel,
  TextField,
  Typography,
  Checkbox,
  FormGroup,
  FormControl,
  FormControlLabel,
  FormLabel,
  RadioGroup,
  Radio,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
} from '@material-ui/core'
import { ToggleButtonGroup, ToggleButton } from '@material-ui/lab'
import { observer } from 'mobx-react'
import { isElectron } from '../util'
import {
  LocalPathLocation,
  FileLocation,
  BlobLocation,
  isUriLocation,
} from '../util/types'
import { getBlob, storeBlobLocation } from '../util/tracks'

interface Account {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
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
    const [internetAccountChecked, setInternetAccountChecked] = useState(false)

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
                } else if (newValue === 'file') {
                  setFileOrUrlState('file')
                }
              }}
              aria-label="file or url picker"
            >
              {new URLSearchParams(window.location.search).get(
                'adminKey',
              ) ? null : (
                <ToggleButton value="file" aria-label="local file">
                  File
                </ToggleButton>
              )}
              <ToggleButton value="url" aria-label="url">
                URL
              </ToggleButton>
            </ToggleButtonGroup>
          </Grid>
          <Grid item>
            {fileOrUrlState === 'url' ? (
              <FormGroup>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={internetAccountChecked}
                      onChange={event => {
                        setInternetAccountChecked(event.target.checked)
                      }}
                    />
                  }
                  label="Requires Login"
                  labelPlacement="start"
                />
              </FormGroup>
            ) : null}
          </Grid>
          <Grid item>
            {fileOrUrlState === 'url' ? (
              <UrlChooser
                {...props}
                internetAccountChecked={internetAccountChecked}
              />
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
  internetAccountChecked: boolean
}) => {
  const {
    location,
    setLocation,
    internetAccounts,
    internetAccountChecked,
  } = props
  const [currentInternetAccount, setCurrentInternetAccount] = useState('')
  const [suggestedInternetAccount, setSuggestedInternetAccount] = useState('')
  const [
    openNewInternetAccountDialog,
    setOpenNewInternetAccountDialog,
  ] = useState(false)
  const [
    additionalInternetAccountIds,
    setAdditionalInternetAccountIds,
  ] = useState<string[]>([])

  const findChosenInternetAccount = (
    urlInput: string,
    internetAccountSelection: string,
  ) => {
    try {
      new URL(urlInput)
    } catch (error) {
      return undefined
    }

    if (internetAccountSelection === 'autoDetect') {
      return internetAccounts?.find(account => {
        return account.handlesLocation({ uri: urlInput })
      })
    }
    const foundSelection = internetAccounts?.find(account => {
      return account.internetAccountId === internetAccountSelection
    })

    return foundSelection
      ? foundSelection
      : {
          internetAccountId: internetAccountSelection,
        }
  }

  const updateLocationWithAccountInfo = (
    uri: string,
    internetAccountId: string,
  ) => {
    const internetAccount = findChosenInternetAccount(uri, internetAccountId)

    setLocation({
      uri: uri,
      baseAuthUri: uri,
      internetAccountId: internetAccount?.internetAccountId || '',
      locationType: 'UriLocation',
    })
  }

  return (
    <>
      <TextField
        fullWidth
        inputProps={{ 'data-testid': 'urlInput' }}
        defaultValue={location && isUriLocation(location) ? location.uri : ''}
        onChange={event => {
          if (event.target.value === '') {
            setCurrentInternetAccount('')
          }
          setSuggestedInternetAccount(
            findChosenInternetAccount(event.target.value, 'autoDetect')?.name ||
              '',
          )
          if (currentInternetAccount) {
            updateLocationWithAccountInfo(
              event.target.value.trim(),
              currentInternetAccount,
            )
          } else {
            setLocation({
              uri: event.target.value.trim(),
              locationType: 'UriLocation',
            })
          }
        }}
      />
      <Grid item>
        {internetAccountChecked && isUriLocation(location) ? (
          <>
            <FormControl component="fieldset">
              <FormLabel component="legend">Select Internet Account</FormLabel>
              <RadioGroup
                value={currentInternetAccount}
                name="internet-account-radio-buttons-group"
                onChange={event => {
                  const internetAccountId = event.target.value
                  setCurrentInternetAccount(internetAccountId)
                  updateLocationWithAccountInfo(
                    location.uri,
                    event.target.value,
                  )
                }}
              >
                <FormControlLabel
                  key=""
                  value=""
                  control={<Radio />}
                  label="None"
                />
                {suggestedInternetAccount && (
                  <FormControlLabel
                    key="suggestedInternetAccount"
                    value={suggestedInternetAccount}
                    control={<Radio />}
                    label={`Suggested: ${suggestedInternetAccount}`}
                  />
                )}
                {internetAccounts?.map(account => {
                  try {
                    // new URL(location.uri)
                    return (
                      <FormControlLabel
                        key={account.internetAccountId}
                        value={account.internetAccountId}
                        control={<Radio />}
                        label={account.name}
                      />
                    )
                  } catch (e) {
                    return null
                  }
                })}
                {additionalInternetAccountIds?.map((accountId: string) => {
                  return (
                    <FormControlLabel
                      key={accountId}
                      value={accountId}
                      control={<Radio />}
                      label={accountId.split('-')[1]}
                    />
                  )
                })}
              </RadioGroup>
              <Button
                variant="outlined"
                onClick={() => setOpenNewInternetAccountDialog(true)}
              >
                Add New Internet Account
              </Button>
            </FormControl>
            {openNewInternetAccountDialog && (
              <AddNewInternetAccountDialog
                internetAccounts={internetAccounts}
                handleClose={(newAddedId?: string) => {
                  if (newAddedId) {
                    setAdditionalInternetAccountIds([
                      ...additionalInternetAccountIds,
                      newAddedId,
                    ])
                    setCurrentInternetAccount(newAddedId)
                    updateLocationWithAccountInfo(location.uri, newAddedId)
                  }
                  setOpenNewInternetAccountDialog(false)
                }}
              />
            )}
          </>
        ) : null}
      </Grid>
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
                  setLocation({
                    localPath: (file as File & { path: string }).path,
                    locationType: 'LocalPathLocation',
                  })
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

const AddNewInternetAccountDialog = ({
  internetAccounts,
  handleClose,
}: {
  internetAccounts: Account[] | undefined
  handleClose: (arg?: string) => void
}) => {
  const [name, setName] = useState('')
  const [type, setType] = useState('')
  return (
    <>
      <Dialog open maxWidth="xl" data-testid="new-internet-account-modal">
        <DialogTitle> Add New Internet Account</DialogTitle>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <label htmlFor="nameTextField">Enter Name for Internet Account</label>
          <TextField
            id="nameTextField"
            required
            variant="outlined"
            onChange={event => {
              setName(event.target.value)
            }}
            margin="dense"
            style={{ margin: 10 }}
          />
          <label htmlFor="internetAccountTypeSelect">
            Select Internet Account Type
          </label>
          <Select
            id="internetAccountTypeSelect"
            value={type}
            onChange={event => {
              setType(event.target.value as string)
            }}
            displayEmpty
          >
            <MenuItem value="HTTPBasicInternetAccount">
              HTTPBasicInternetAccount
            </MenuItem>
            {internetAccounts?.map(account => {
              return (
                <MenuItem key={account.type} value={account.type}>
                  {account.type}
                </MenuItem>
              )
            })}
          </Select>
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            color="primary"
            type="submit"
            disabled={!name || !type}
            onClick={() => {
              if (name && type) {
                handleClose(`${type}-${name}`)
              }
            }}
          >
            Submit
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              handleClose(undefined)
            }}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default FileLocationEditor
