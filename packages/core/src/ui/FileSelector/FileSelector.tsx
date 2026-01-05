import { useCallback, useEffect, useState } from 'react'

import { Box, FormGroup, FormHelperText, InputLabel } from '@mui/material'
import { observer } from 'mobx-react'

import LocationInput from './LocationInput'
import SourceTypeSelector from './SourceTypeSelector'
import useInternetAccounts from './useInternetAccounts'
import { notEmpty } from '../../util'
import { isUriLocation } from '../../util/types'

import type { AbstractRootModel, FileLocation } from '../../util/types'

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

const FileSelector = observer(function FileSelector({
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

  const selectSourceType = useCallback(
    (newValue: string | null) => {
      setRecentlyUsed([
        ...new Set([newValue, ...recentlyUsed].filter(notEmpty)),
      ])
      if (newValue) {
        setToggleButtonValue(newValue)
      }
      if (isUriLocation(location)) {
        setLocationWithAccount(location)
      }
    },
    [location, recentlyUsed, setRecentlyUsed, setLocationWithAccount],
  )

  return (
    <>
      <Box display="flex">
        <InputLabel shrink>{name}</InputLabel>
      </Box>
      <FormGroup>
        <Box display="flex" flexDirection={inline ? 'row' : 'column'} gap={0.5}>
          <SourceTypeSelector
            value={toggleButtonValue}
            shownAccountIds={shownAccountIds}
            hiddenAccountIds={hiddenAccountIds}
            accountMap={accountMap}
            onChange={(_event, newValue) => {
              selectSourceType(newValue)
            }}
            onHiddenAccountSelect={selectSourceType}
          />
          <LocationInput
            toggleButtonValue={toggleButtonValue}
            selectedAccount={selectedAccount}
            location={location}
            inline={inline}
            setLocation={setLocationWithAccount}
          />
        </Box>
      </FormGroup>
      <FormHelperText>{description}</FormHelperText>
    </>
  )
})

export default FileSelector
