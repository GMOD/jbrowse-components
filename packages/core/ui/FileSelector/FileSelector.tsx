import { useCallback, useEffect, useState } from 'react'

import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import {
  Box,
  FormGroup,
  FormHelperText,
  InputLabel,
  Menu,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@mui/material'
import { observer } from 'mobx-react'

import LocalFileChooser from './LocalFileChooser'
import UrlChooser from './UrlChooser'
import { notEmpty, useLocalStorage } from '../../util'
import { isAppRootModel, isUriLocation } from '../../util/types'

import type { BaseInternetAccountModel } from '../../pluggableElementTypes'
import type { AbstractRootModel, FileLocation } from '../../util/types'
import type { ToggleButtonProps } from '@mui/material'

const NUM_SHOWN = 2

function shorten(str: string, len: number) {
  return str.length > len ? `${str.slice(0, len)}…` : str
}

function ToggleButtonWithTooltip(props: ToggleButtonProps) {
  const { title, children, ...other } = props
  return (
    <Tooltip title={title || ''}>
      <ToggleButton {...other}>{children}</ToggleButton>
    </Tooltip>
  )
}

function useInternetAccounts(rootModel?: AbstractRootModel) {
  const [recentlyUsed, setRecentlyUsed] = useLocalStorage(
    'fileSelector-recentlyUsedInternetAccounts',
    [] as string[],
  )

  const accounts = isAppRootModel(rootModel)
    ? rootModel.internetAccounts.filter(
        f => f.type !== 'HTTPBasicInternetAccount',
      )
    : []

  const accountMap = Object.fromEntries(
    accounts.map(a => [a.internetAccountId, a]),
  )
  const sortedIds = [...new Set(accounts.map(s => s.internetAccountId))].sort(
    (a, b) => recentlyUsed.indexOf(a) - recentlyUsed.indexOf(b),
  )

  return {
    accountMap,
    shownAccountIds: sortedIds.slice(0, NUM_SHOWN),
    hiddenAccountIds: sortedIds.slice(NUM_SHOWN),
    recentlyUsed,
    setRecentlyUsed,
  }
}

function LocationInput({
  toggleButtonValue,
  selectedAccount,
  inline,
  setLocation,
}: {
  toggleButtonValue: string
  selectedAccount?: BaseInternetAccountModel
  inline?: boolean
  setLocation: (arg: FileLocation) => void
}) {
  if (selectedAccount?.SelectorComponent) {
    return (
      <selectedAccount.SelectorComponent
        setLocation={setLocation}
        selectedAccount={selectedAccount}
      />
    )
  }
  if (toggleButtonValue === 'url') {
    return (
      <UrlChooser
        setLocation={setLocation}
        label={selectedAccount?.selectorLabel}
        style={inline ? { margin: 0 } : undefined}
      />
    )
  }
  if (toggleButtonValue === 'file') {
    return <LocalFileChooser setLocation={setLocation} />
  }
  return null
}

function getInitialToggleValue(location?: FileLocation) {
  if (
    location &&
    'internetAccountId' in location &&
    location.internetAccountId
  ) {
    return location.internetAccountId
  }
  return !location || isUriLocation(location) ? 'url' : 'file'
}

const isAdminMode = () =>
  new URLSearchParams(window.location.search).get('adminKey') !== null

function HiddenAccountsMenu({
  anchorEl,
  hiddenAccountIds,
  accountMap,
  onClose,
  onSelect,
}: {
  anchorEl: HTMLElement | null
  hiddenAccountIds: string[]
  accountMap: Record<string, BaseInternetAccountModel>
  onClose: () => void
  onSelect: (id: string) => void
}) {
  if (!anchorEl) {
    return null
  }
  return (
    <Menu
      open
      anchorEl={anchorEl}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      onClose={onClose}
    >
      {hiddenAccountIds.map(id => (
        <MenuItem
          key={id}
          value={id}
          onClick={() => {
            onSelect(id)
          }}
        >
          {accountMap[id]!.name}
        </MenuItem>
      ))}
    </Menu>
  )
}

const FileSelector = observer(function ({
  inline,
  location,
  name,
  description,
  rootModel,
  setLocation,
}: {
  location?: FileLocation
  name?: string
  description?: string
  inline?: boolean
  rootModel?: AbstractRootModel
  setLocation: (param: FileLocation) => void
  setName?: (str: string) => void
}) {
  const [toggleButtonValue, setToggleButtonValue] = useState(() =>
    getInitialToggleValue(location),
  )
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  const {
    accountMap,
    shownAccountIds,
    hiddenAccountIds,
    recentlyUsed,
    setRecentlyUsed,
  } = useInternetAccounts(rootModel)

  const selectedAccount = accountMap[toggleButtonValue]

  const setLocationWithAccount = useCallback(
    (loc: FileLocation) => {
      setLocation({
        ...loc,
        ...(selectedAccount && isUriLocation(loc)
          ? { internetAccountId: selectedAccount.internetAccountId }
          : {}),
      })
    },
    [setLocation, selectedAccount],
  )

  useEffect(() => {
    if (
      selectedAccount &&
      isUriLocation(location) &&
      location.internetAccountId !== selectedAccount.internetAccountId
    ) {
      setLocationWithAccount(location)
    }
  }, [location, selectedAccount, setLocationWithAccount])

  const handleToggleChange = useCallback(
    (_event: React.MouseEvent, newState: string | null) => {
      setRecentlyUsed([
        ...new Set([newState, ...recentlyUsed].filter(notEmpty)),
      ])
      if (newState) {
        setToggleButtonValue(newState)
      }
      if (isUriLocation(location)) {
        setLocationWithAccount(location)
      }
    },
    [location, recentlyUsed, setRecentlyUsed, setLocationWithAccount],
  )

  const handleMenuItemClick = useCallback(
    (internetAccountId: string) => {
      setRecentlyUsed([
        ...new Set([internetAccountId, ...recentlyUsed].filter(notEmpty)),
      ])
      setToggleButtonValue(internetAccountId)
      setAnchorEl(null)
    },
    [recentlyUsed, setRecentlyUsed],
  )

  const inputElement = (
    <LocationInput
      toggleButtonValue={toggleButtonValue}
      selectedAccount={selectedAccount}
      inline={inline}
      setLocation={setLocationWithAccount}
    />
  )

  return (
    <>
      <Box display="flex">
        <InputLabel shrink>{name}</InputLabel>
      </Box>
      <FormGroup>
        <Box display="flex" flexDirection={inline ? 'row' : 'column'} gap={0.5}>
          <ToggleButtonGroup
            value={toggleButtonValue}
            exclusive
            size="small"
            onChange={handleToggleChange}
            aria-label="file, url, or account picker"
          >
            {isAdminMode() ? null : (
              <ToggleButton size="small" value="file" aria-label="local file">
                File
              </ToggleButton>
            )}
            <ToggleButton size="small" value="url" aria-label="url">
              URL
            </ToggleButton>
            {shownAccountIds.map(id => {
              const account = accountMap[id]!
              const { toggleContents, name: accountName } = account
              const label =
                typeof toggleContents === 'string'
                  ? shorten(toggleContents, 5)
                  : toggleContents || shorten(accountName, 5)
              return (
                <ToggleButtonWithTooltip
                  key={id}
                  value={id}
                  title={accountName}
                >
                  {label}
                </ToggleButtonWithTooltip>
              )
            })}
            {hiddenAccountIds.length > 0 ? (
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
          {inputElement}
        </Box>
      </FormGroup>
      <FormHelperText>{description}</FormHelperText>
      <HiddenAccountsMenu
        anchorEl={anchorEl}
        hiddenAccountIds={hiddenAccountIds}
        accountMap={accountMap}
        onClose={() => {
          setAnchorEl(null)
        }}
        onSelect={handleMenuItemClick}
      />
    </>
  )
})

export default FileSelector
