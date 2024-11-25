import React, { useCallback, useEffect, useState } from 'react'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import {
  Box,
  FormHelperText,
  InputLabel,
  Menu,
  MenuItem,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material'
import { observer } from 'mobx-react'

// locals
import LocalFileChooser from './LocalFileChooser'
import UrlChooser from './UrlChooser'
import { notEmpty, useLocalStorage } from '../../util'
import { isUriLocation, isAppRootModel } from '../../util/types'
import type { FileLocation, AbstractRootModel } from '../../util/types'
import type { ToggleButtonProps } from '@mui/material'

// icons

const NUM_SHOWN = 2

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
    return `${str.slice(0, Math.max(0, len))}…`
  }
  return str
}

const FileSelector = observer(function (props: {
  location?: FileLocation
  setLocation: (param: FileLocation) => void
  setName?: (str: string) => void
  name?: string
  description?: string
  rootModel?: AbstractRootModel
}) {
  const { location, name, description, rootModel, setLocation } = props
  const fileOrUrl = !location || isUriLocation(location) ? 'url' : 'file'
  const [toggleButtonValue, setToggleButtonValue] = useState(
    location && 'internetAccountId' in location && location.internetAccountId
      ? location.internetAccountId
      : fileOrUrl,
  )
  const accounts = isAppRootModel(rootModel)
    ? rootModel.internetAccounts.filter(
        f => f.type !== 'HTTPBasicInternetAccount',
      )
    : []

  const [recentlyUsedInternetAccounts, setRecentlyUsedInternetAccounts] =
    useLocalStorage('fileSelector-recentlyUsedInternetAccounts', [] as string[])

  const map = Object.fromEntries(accounts.map(a => [a.internetAccountId, a]))
  const arr = [...new Set(accounts.map(s => s.internetAccountId))].sort(
    (a, b) =>
      recentlyUsedInternetAccounts.indexOf(a) -
      recentlyUsedInternetAccounts.indexOf(b),
  )
  const shownAccounts = arr.slice(0, NUM_SHOWN)
  const hiddenAccounts = arr.slice(NUM_SHOWN)
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const selectedAccount = map[toggleButtonValue]

  const setLocationWithAccount = useCallback(
    (location: FileLocation) => {
      setLocation({
        ...location,
        ...(selectedAccount && isUriLocation(location)
          ? { internetAccountId: selectedAccount.internetAccountId }
          : {}),
      })
    },
    [setLocation, selectedAccount],
  )

  useEffect(() => {
    // if you swap account selection after inputting url
    if (
      selectedAccount &&
      isUriLocation(location) &&
      location.internetAccountId !== selectedAccount.internetAccountId
    ) {
      setLocationWithAccount(location)
    }
  }, [location, selectedAccount, setLocationWithAccount])

  let locationInput = (
    <UrlChooser
      {...props}
      setLocation={setLocationWithAccount}
      label={selectedAccount?.selectorLabel}
    />
  )
  if (toggleButtonValue === 'file') {
    locationInput = <LocalFileChooser {...props} />
  }
  if (selectedAccount?.SelectorComponent) {
    const { SelectorComponent } = selectedAccount
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
              setRecentlyUsedInternetAccounts([
                ...new Set(
                  [newState, ...recentlyUsedInternetAccounts].filter(notEmpty),
                ),
              ])
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
            {shownAccounts.map(id => {
              const { internetAccountId, name, toggleContents } = map[id]!
              return (
                <ToggleButtonWithTooltip
                  key={id}
                  value={internetAccountId}
                  title={name}
                >
                  {typeof toggleContents === 'string'
                    ? shorten(toggleContents, 5)
                    : toggleContents || shorten(name, 5)}
                </ToggleButtonWithTooltip>
              )
            })}
            {hiddenAccounts.length > 0 ? (
              // @ts-expect-error
              <ToggleButton
                onClick={event => {
                  setAnchorEl(event.target as HTMLElement)
                }}
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
            onClose={() => {
              setAnchorEl(null)
            }}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            transformOrigin={{ vertical: 'top', horizontal: 'center' }}
          >
            {hiddenAccounts.map(id => {
              const { internetAccountId, name } = map[id]!
              return (
                <MenuItem
                  key={id}
                  value={internetAccountId}
                  onClick={() => {
                    setRecentlyUsedInternetAccounts([
                      ...new Set(
                        [
                          internetAccountId,
                          ...recentlyUsedInternetAccounts,
                        ].filter(notEmpty),
                      ),
                    ])

                    setToggleButtonValue(internetAccountId)
                    setAnchorEl(null)
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
})

export default FileSelector
