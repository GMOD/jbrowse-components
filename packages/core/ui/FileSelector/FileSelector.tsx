import React, { useState, useRef } from 'react'
import {
  Box,
  FormHelperText,
  InputLabel,
  MenuItem,
  Tooltip,
  Paper,
  Popper,
  Grow,
  ClickAwayListener,
  Menu,
} from '@material-ui/core'

import {
  ToggleButtonGroup,
  ToggleButton,
  ToggleButtonProps,
} from '@material-ui/lab'
import { observer } from 'mobx-react'
import {
  FileLocation,
  UriLocation,
  AbstractSessionModel,
  isUriLocation,
} from '../../util/types'
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown'
import LocalFileChooser from './LocalFileChooser'
import UrlChooser from './UrlChooser'

function ToggleButtonWithTooltip(props: ToggleButtonProps) {
  const { title, children, ...other } = props
  return (
    <Tooltip title={title || ''}>
      <ToggleButton {...other}>{children}</ToggleButton>
    </Tooltip>
  )
}

const FileSelector = observer(
  (props: {
    location?: FileLocation
    setLocation: (param: FileLocation) => void
    setName?: (str: string) => void
    name?: string
    description?: string
    session?: AbstractSessionModel
  }) => {
    const { location, name, description, session, setLocation } = props
    const fileOrUrl = !location || isUriLocation(location) ? 'url' : 'file'
    const [toggleButtonValue, setToggleButtonValue] = useState(
      location && 'internetAccountId' in location && location.internetAccountId
        ? location.internetAccountId
        : fileOrUrl,
    )
    const { internetAccounts = [] } = session || {}
    const numAccountsShown = 2
    const [shownInternetAccounts, setShownInternetAccounts] = useState(
      internetAccounts.slice(0, numAccountsShown),
    )
    const [hiddenInternetAccounts, setHiddenInternetAccounts] = useState(
      internetAccounts.slice(numAccountsShown),
    )
    const [moreMenuOpen, setMoreMenuOpen] = useState(false)
    const moreMenuRef = useRef(null)

    const selectedInternetAccount = internetAccounts.find(
      ia => ia.internetAccountId === toggleButtonValue,
    )

    const setLocationWithAccount = (location: UriLocation) => {
      setLocation({
        ...location,
        internetAccountId: selectedInternetAccount
          ? selectedInternetAccount.internetAccountId
          : undefined,
      })
    }

    // if you swap account selection after inputting url
    if (
      location &&
      selectedInternetAccount &&
      isUriLocation(location) &&
      location.internetAccountId !== selectedInternetAccount.internetAccountId
    ) {
      setLocationWithAccount(location)
    }

    let locationInput = (
      <UrlChooser
        {...props}
        setLocation={setLocationWithAccount}
        label={selectedInternetAccount?.selectorLabel}
      />
    )
    if (toggleButtonValue === 'file') {
      locationInput = <LocalFileChooser {...props} />
    }
    if (selectedInternetAccount?.SelectorComponent) {
      const { SelectorComponent } = selectedInternetAccount
      locationInput = (
        <SelectorComponent {...props} setLocation={setLocationWithAccount} />
      )
    }

    const handleChange = (
      _event: React.MouseEvent<HTMLElement>,
      newState: string,
    ) => {
      if (newState) {
        setToggleButtonValue(newState)
      }
      if (isUriLocation(location)) {
        setLocationWithAccount(location)
      }
    }

    return (
      <>
        <Box display="flex">
          <InputLabel shrink>{name}</InputLabel>
        </Box>
        <Box display="flex" flexDirection="row">
          <Box>
            <ToggleButtonGroup
              value={toggleButtonValue}
              exclusive
              onChange={handleChange}
              aria-label="file, url, or account picker"
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
              {shownInternetAccounts?.map(internetAccount => {
                const { toggleContents: customToggleContents, name } =
                  internetAccount
                let toggleContents = customToggleContents || name
                const maxLength = 5
                if (
                  typeof toggleContents === 'string' &&
                  toggleContents.length > maxLength
                ) {
                  toggleContents = `${toggleContents.substring(0, maxLength)}…`
                }
                return (
                  <ToggleButtonWithTooltip
                    key={internetAccount.internetAccountId}
                    value={internetAccount.internetAccountId}
                    aria-label={internetAccount.name}
                    title={name}
                  >
                    {toggleContents}
                  </ToggleButtonWithTooltip>
                )
              })}
              {hiddenInternetAccounts.length ? (
                <ToggleButton
                  value="moreMenu"
                  onClick={() => {
                    setMoreMenuOpen((prevOpen: boolean) => !prevOpen)
                  }}
                  selected={false}
                  ref={moreMenuRef}
                >
                  More
                  <ArrowDropDownIcon />
                </ToggleButton>
              ) : null}
            </ToggleButtonGroup>
            <Popper
              open={moreMenuOpen}
              anchorEl={moreMenuRef.current}
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
                    <ClickAwayListener
                      onClickAway={() => setMoreMenuOpen(false)}
                    >
                      <Menu
                        open={moreMenuOpen}
                        anchorEl={moreMenuRef.current}
                        id="split-button-menu"
                        onClose={() => setMoreMenuOpen(false)}
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
                        {hiddenInternetAccounts?.map((account, idx) => (
                          <MenuItem
                            key={account.internetAccountId}
                            value={account.internetAccountId}
                            onClick={() => {
                              const newlySelectedInternetAccount =
                                hiddenInternetAccounts[idx]
                              const lastShownInternetAccount =
                                shownInternetAccounts[
                                  shownInternetAccounts.length - 1
                                ]
                              setShownInternetAccounts([
                                ...shownInternetAccounts.slice(
                                  0,
                                  shownInternetAccounts.length - 1,
                                ),
                                newlySelectedInternetAccount,
                              ])
                              setHiddenInternetAccounts([
                                lastShownInternetAccount,
                                ...hiddenInternetAccounts.slice(0, idx),
                                ...hiddenInternetAccounts.slice(idx + 1),
                              ])
                              setToggleButtonValue(account.internetAccountId)
                              setMoreMenuOpen(false)
                            }}
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
          </Box>
        </Box>
        {locationInput}
        <FormHelperText>{description}</FormHelperText>
      </>
    )
  },
)

export default FileSelector
