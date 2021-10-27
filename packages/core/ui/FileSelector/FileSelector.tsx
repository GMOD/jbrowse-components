import React, { useState, useRef } from 'react'
import {
  Box,
  FormHelperText,
  InputLabel,
  MenuItem,
  Tooltip,
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

function shortenIfNeeded(str: React.ReactNode | string, maxLength: number) {
  if (typeof str === 'string' && str.length > maxLength) {
    str = `${str.substring(0, maxLength)}…`
  }
  return str
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
    const { internetAccounts: accounts = [] } = session || {}
    const shown = 2
    const [shownAccounts, setShownAccounts] = useState(accounts.slice(0, shown))
    const [hiddenAccounts, setHiddenAccounts] = useState(accounts.slice(shown))
    const [moreMenuOpen, setMoreMenuOpen] = useState(false)
    const moreMenuRef = useRef(null)

    const selectedInternetAccount = accounts.find(
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
        <Box display="flex">
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
              {shownAccounts?.map(acct => {
                const { name, internetAccountId, toggleContents = name } = acct
                return (
                  <ToggleButtonWithTooltip
                    key={internetAccountId}
                    value={internetAccountId}
                    aria-label={name}
                    title={name}
                  >
                    {shortenIfNeeded(toggleContents, 5)}
                  </ToggleButtonWithTooltip>
                )
              })}
              {hiddenAccounts.length ? (
                <ToggleButton
                  onClick={() => setMoreMenuOpen(prevOpen => !prevOpen)}
                  selected={false}
                  ref={moreMenuRef}
                >
                  <ArrowDropDownIcon />
                </ToggleButton>
              ) : null}
            </ToggleButtonGroup>
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
              {hiddenAccounts.map((acct, idx) => {
                const { internetAccountId, name } = acct
                return (
                  <MenuItem
                    key={internetAccountId}
                    value={internetAccountId}
                    onClick={() => {
                      const selection = hiddenAccounts[idx]
                      const previous = shownAccounts[shownAccounts.length - 1]
                      setShownAccounts([
                        ...shownAccounts.slice(0, shownAccounts.length - 1),
                        selection,
                      ])
                      setHiddenAccounts([
                        previous,
                        ...hiddenAccounts.slice(0, idx),
                        ...hiddenAccounts.slice(idx + 1),
                      ])
                      setToggleButtonValue(internetAccountId)
                      setMoreMenuOpen(false)
                    }}
                  >
                    {name}
                  </MenuItem>
                )
              })}
            </Menu>
          </Box>
        </Box>
        {locationInput}
        <FormHelperText>{description}</FormHelperText>
      </>
    )
  },
)

export default FileSelector
