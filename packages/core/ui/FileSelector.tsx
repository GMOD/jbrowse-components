import React, { useState, useRef } from 'react'
import {
  Button,
  Grid,
  FormHelperText,
  InputLabel,
  TextField,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  Tooltip,
  Paper,
  Popper,
  Grow,
  ClickAwayListener,
  Menu,
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
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown'
import AddIcon from '@material-ui/icons/Add'
import { Info } from '@material-ui/icons'

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
    const { location, name, description, internetAccounts } = props
    const fileOrUrl = !location || isUriLocation(location) ? 'url' : 'file'
    const [currentState, setCurrentState] = useState(fileOrUrl)

    // states for internet account logic
    const [buttonOpen, setButtonOpen] = useState(false)
    const [
      openNewInternetAccountDialog,
      setOpenNewInternetAccountDialog,
    ] = useState(false)
    const [
      additionalInternetAccounts,
      setAdditionalInternetAccounts,
    ] = useState<Account[]>([])
    const [displayedInternetAccount, setDisplayedInternetAccount] = useState<
      Account | undefined
    >(internetAccounts ? internetAccounts[0] : undefined)
    const anchorRef = useRef(null)

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

    const handleChange = async (
      event: React.MouseEvent<HTMLElement>,
      newState: string,
    ) => {
      setCurrentState(newState)
    }

    return (
      <>
        <InputLabel shrink htmlFor="callback-editor">
          {name}
        </InputLabel>
        <Grid container spacing={1} direction="row" alignItems="center">
          <Grid item>
            <ToggleButtonGroup
              value={currentState}
              exclusive
              onChange={handleChange}
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
              {displayedInternetAccount && (
                <ToggleButton
                  value={displayedInternetAccount.internetAccountId}
                >
                  {displayedInternetAccount.name.length > 12
                    ? `${displayedInternetAccount.name.substring(0, 12)}...`
                    : displayedInternetAccount.name}
                </ToggleButton>
              )}
              <Button
                size="small"
                variant="outlined"
                value="selection"
                onClick={() => {
                  setButtonOpen((prevOpen: boolean) => !prevOpen)
                }}
                style={{ minWidth: 5 }}
                ref={anchorRef}
              >
                <ArrowDropDownIcon />
              </Button>
            </ToggleButtonGroup>
            <Popper
              open={buttonOpen}
              anchorEl={anchorRef.current}
              role={undefined}
              transition
              disablePortal
            >
              {({ TransitionProps, placement }) => (
                <Grow
                  {...TransitionProps}
                  style={{
                    transformOrigin:
                      placement === 'bottom' ? 'center top' : 'center bottom',
                  }}
                >
                  <Paper>
                    <ClickAwayListener onClickAway={() => setButtonOpen(false)}>
                      <Menu
                        open={buttonOpen}
                        anchorEl={anchorRef.current}
                        id="split-button-menu"
                        onClose={() => setButtonOpen(false)}
                        getContentAnchorEl={null}
                        anchorOrigin={{
                          vertical: 'bottom',
                          horizontal: 'center',
                        }}
                        transformOrigin={{
                          vertical: 'top',
                          horizontal: 'center',
                        }}
                      >
                        {internetAccounts?.map(account => (
                          <MenuItem
                            key={account.internetAccountId}
                            value={account.internetAccountId}
                            onClick={() => {
                              setDisplayedInternetAccount(account)
                              setCurrentState(account.internetAccountId)
                              setButtonOpen(false)
                            }}
                          >
                            {/* {findChosenInternetAccount(
                              account.internetAccountId,
                              'autoDetect',
                            )?.name === account.name
                              ? '(Suggested)'
                              : ''}{' '} */}
                            {account.name}
                          </MenuItem>
                        ))}
                        {additionalInternetAccounts.map(account => (
                          <MenuItem
                            key={account.internetAccountId}
                            value={account.internetAccountId}
                          >
                            {account.name}
                          </MenuItem>
                        ))}
                      </Menu>
                    </ClickAwayListener>
                  </Paper>
                </Grow>
              )}
            </Popper>
          </Grid>
          <Grid>
            <Tooltip title="Add Account for Authentication">
              <Button
                color="primary"
                variant="contained"
                onClick={() => setOpenNewInternetAccountDialog(true)}
                style={{ minWidth: 15 }}
              >
                <AddIcon />
              </Button>
            </Tooltip>
          </Grid>
          <Grid item>
            {currentState === 'file' ? (
              <LocalFileChooser {...props} />
            ) : (
              <UrlChooser
                {...props}
                currentInternetAccount={
                  currentState === displayedInternetAccount?.internetAccountId
                    ? displayedInternetAccount
                    : undefined
                }
              />
            )}
          </Grid>
        </Grid>
        {openNewInternetAccountDialog && (
          <AddNewInternetAccountDialog
            internetAccounts={internetAccounts}
            handleClose={(newAddedAccount: Account | undefined) => {
              if (newAddedAccount) {
                setDisplayedInternetAccount(newAddedAccount)
                setCurrentState(newAddedAccount.internetAccountId)
                setAdditionalInternetAccounts([
                  ...additionalInternetAccounts,
                  newAddedAccount,
                ])
              }
              setOpenNewInternetAccountDialog(false)
            }}
          />
        )}
        <FormHelperText>{description}</FormHelperText>
      </>
    )
  },
)

const UrlChooser = (props: {
  location?: FileLocation
  setLocation: Function
  currentInternetAccount: Account | undefined
}) => {
  const { location, setLocation, currentInternetAccount } = props

  return (
    <>
      <TextField
        fullWidth
        inputProps={{ 'data-testid': 'urlInput' }}
        defaultValue={location && isUriLocation(location) ? location.uri : ''}
        label="Enter URL"
        onChange={event => {
          if (currentInternetAccount) {
            setLocation({
              uri: event.target.value,
              baseAuthUri: event.target.value,
              internetAccountId: currentInternetAccount.internetAccountId || '',
              locationType: 'UriLocation',
            })
          } else {
            setLocation({
              uri: event.target.value.trim(),
              locationType: 'UriLocation',
            })
          }
        }}
      />
      {currentInternetAccount && (
        <Grid item>
          <Info />
          <Typography
            color="textSecondary"
            variant="caption"
            style={{ paddingLeft: '4px' }}
          >
            Your data will be authenticated using {currentInternetAccount.name}
          </Typography>
        </Grid>
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
  handleClose: (arg?: Account) => void
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
                handleClose({
                  internetAccountId: `${type}-${name}`,
                  name: name,
                  type: type,
                })
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
