import React, { useCallback, useEffect, useState } from 'react'
import { observer } from 'mobx-react'
import {
  Box,
  FormHelperText,
  InputLabel,
  Menu,
  MenuItem,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
  ToggleButtonProps,
} from '@mui/material'

// locals
import {
  FileLocation,
  AbstractRootModel,
  isUriLocation,
  isAppRootModel,
} from '../../util/types'
import LocalFileChooser from './LocalFileChooser'
import UrlChooser from './UrlChooser'

// icons
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'

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

export default observer(function (props: {
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
  const accts = isAppRootModel(rootModel) ? [...rootModel.internetAccounts] : []
  const numShown = 2
  const [shownAccts, setShownAccts] = useState(accts.slice(0, numShown))
  const [hiddenAccts, setHiddenAccts] = useState(accts.slice(numShown))
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  const selectedAcct = accts.find(
    i => i.internetAccountId === toggleButtonValue,
  )

  const setLocationWithAcct = useCallback(
    (location: FileLocation) => {
      setLocation({
        ...location,
        ...(isUriLocation(location)
          ? { internetAccountId: selectedAcct?.internetAccountId }
          : {}),
      })
    },
    [setLocation, selectedAcct],
  )

  useEffect(() => {
    // if you swap account selection after inputting url
    if (
      selectedAcct &&
      isUriLocation(location) &&
      location.internetAccountId !== selectedAcct.internetAccountId
    ) {
      setLocationWithAcct(location)
    }
  }, [location, selectedAcct, setLocationWithAcct])

  let locationInput = (
    <UrlChooser
      {...props}
      setLocation={setLocationWithAcct}
      label={selectedAcct?.selectorLabel}
    />
  )
  if (toggleButtonValue === 'file') {
    locationInput = <LocalFileChooser {...props} />
  }
  if (selectedAcct?.SelectorComponent) {
    const { SelectorComponent } = selectedAcct
    locationInput = (
      <SelectorComponent {...props} setLocation={setLocationWithAcct} />
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
                setLocationWithAcct(location)
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
            {hiddenAccts.length > 0 ? (
              // @ts-expect-error
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
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            transformOrigin={{ vertical: 'top', horizontal: 'center' }}
          >
            {hiddenAccts?.map((acct, idx) => (
              <MenuItem
                key={acct.internetAccountId}
                value={acct.internetAccountId}
                onClick={() => {
                  const prev = shownAccts[shownAccts.length - 1]
                  setShownAccts([...shownAccts.slice(0, -1), acct])
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
})
