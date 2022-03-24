import React, { useState } from 'react'
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
  isUriLocation,
  AbstractRootModel,
  isAppRootModel,
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

function shorten(str: string, len: number) {
  if (typeof str === 'string' && str.length > len) {
    return `${str.substring(0, len)}…`
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
    rootModel?: AbstractRootModel
  }) => {
    const { location, name, description, rootModel, setLocation } = props
    const fileOrUrl = !location || isUriLocation(location) ? 'url' : 'file'
    const [toggleButtonValue, setToggleButtonValue] = useState(
      location && 'internetAccountId' in location && location.internetAccountId
        ? location.internetAccountId
        : fileOrUrl,
    )
    const accts = isAppRootModel(rootModel)
      ? rootModel.internetAccounts.slice()
      : []
    const numShown = 2
    const [shownAccts, setShownAccts] = useState(accts.slice(0, numShown))
    const [hiddenAccts, setHiddenAccts] = useState(accts.slice(numShown))
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

    const selectedAcct = accts.find(
      ia => ia.internetAccountId === toggleButtonValue,
    )

    const setLocationWithAccount = (location: UriLocation) => {
      setLocation({
        ...location,
        internetAccountId: selectedAcct
          ? selectedAcct.internetAccountId
          : undefined,
      })
    }

    // if you swap account selection after inputting url
    if (
      location &&
      selectedAcct &&
      isUriLocation(location) &&
      location.internetAccountId !== selectedAcct.internetAccountId
    ) {
      setLocationWithAccount(location)
    }

    let locationInput = (
      <UrlChooser
        {...props}
        setLocation={setLocationWithAccount}
        label={selectedAcct?.selectorLabel}
      />
    )
    if (toggleButtonValue === 'file') {
      locationInput = <LocalFileChooser {...props} />
    }
    if (selectedAcct?.SelectorComponent) {
      const { SelectorComponent } = selectedAcct
      locationInput = (
        <SelectorComponent {...props} setLocation={setLocationWithAccount} />
      )
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
              onChange={(_event, newState) => {
                if (newState) {
                  setToggleButtonValue(newState)
                }
                if (isUriLocation(location)) {
                  setLocationWithAccount(location)
                }
              }}
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
              {shownAccts.map(({ internetAccountId, toggleContents, name }) => (
                <ToggleButtonWithTooltip
                  key={internetAccountId}
                  value={internetAccountId}
                  aria-label={name}
                  title={name}
                >
                  {typeof toggleContents === 'string'
                    ? shorten(toggleContents, 5)
                    : toggleContents || shorten(name, 5)}
                </ToggleButtonWithTooltip>
              ))}
              {hiddenAccts.length ? (
                <ToggleButton
                  onClick={event => setAnchorEl(event.target as HTMLElement)}
                  selected={false}
                >
                  More
                  <ArrowDropDownIcon />
                </ToggleButton>
              ) : null}
            </ToggleButtonGroup>

            <Menu
              open={Boolean(anchorEl)}
              anchorEl={anchorEl}
              onClose={() => setAnchorEl(null)}
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
              {hiddenAccts?.map((acct, idx) => (
                <MenuItem
                  key={acct.internetAccountId}
                  value={acct.internetAccountId}
                  onClick={() => {
                    const prev = shownAccts[shownAccts.length - 1]
                    setShownAccts([
                      ...shownAccts.slice(0, shownAccts.length - 1),
                      acct,
                    ])
                    setHiddenAccts([
                      prev,
                      ...hiddenAccts.slice(0, idx),
                      ...hiddenAccts.slice(idx + 1),
                    ])
                    setToggleButtonValue(acct.internetAccountId)
                    setAnchorEl(null)
                  }}
                >
                  {acct.name}
                </MenuItem>
              ))}
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
