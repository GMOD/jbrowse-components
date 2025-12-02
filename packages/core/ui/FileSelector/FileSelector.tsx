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

function Inline({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 4 }}>{children}</div>
}

function Box2({ children }: { children: React.ReactNode }) {
  return (
    <Box display="flex" flexDirection="row">
      <Box>{children}</Box>
    </Box>
  )
}

function Input(props: {
  toggleButtonValue: string
  selectedAccount?: BaseInternetAccountModel
  inline?: boolean
  setLocation: (arg: FileLocation) => void
}) {
  const { setLocation, inline, toggleButtonValue, selectedAccount } = props
  return (
    <>
      {selectedAccount?.SelectorComponent ? (
        <selectedAccount.SelectorComponent
          {...props}
          setLocation={setLocation}
        />
      ) : toggleButtonValue === 'url' ? (
        <UrlChooser
          {...props}
          setLocation={setLocation}
          label={selectedAccount?.selectorLabel}
          style={inline ? { margin: 0 } : undefined}
        />
      ) : toggleButtonValue === 'file' ? (
        <LocalFileChooser {...props} />
      ) : null}
    </>
  )
}

const FileSelector = observer(function (props: {
  location?: FileLocation
  name?: string
  description?: string
  inline?: boolean
  rootModel?: AbstractRootModel
  setLocation: (param: FileLocation) => void
  setName?: (str: string) => void
}) {
  const { inline, location, name, description, rootModel, setLocation } = props
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

  const Wrapper = inline ? Inline : Box2

  return (
    <>
      <Box display="flex">
        <InputLabel shrink>{name}</InputLabel>
      </Box>
      <FormGroup>
        <Wrapper>
          <ToggleButtonGroup
            value={toggleButtonValue}
            exclusive
            size="small"
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
              <ToggleButton size="small" value="file" aria-label="local file">
                File
              </ToggleButton>
            )}
            <ToggleButton size="small" value="url" aria-label="url">
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
              <ToggleButton
                value="more"
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
          {inline ? (
            <Input
              {...props}
              toggleButtonValue={toggleButtonValue}
              selectedAccount={selectedAccount}
              setLocation={setLocationWithAccount}
            />
          ) : null}
        </Wrapper>
        {!inline ? (
          <Input
            {...props}
            toggleButtonValue={toggleButtonValue}
            selectedAccount={selectedAccount}
            setLocation={setLocationWithAccount}
          />
        ) : null}
      </FormGroup>
      <FormHelperText>{description}</FormHelperText>
      {anchorEl ? (
        <Menu
          open
          anchorEl={anchorEl}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          transformOrigin={{ vertical: 'top', horizontal: 'center' }}
          onClose={() => {
            setAnchorEl(null)
          }}
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
      ) : null}
    </>
  )
})

export default FileSelector
