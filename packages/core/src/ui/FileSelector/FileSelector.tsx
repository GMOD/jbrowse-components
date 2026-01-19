import { useCallback, useEffect, useState } from 'react'

import { Box, FormGroup, FormHelperText, InputLabel } from '@mui/material'
import { observer } from 'mobx-react'

import LocationInput from './LocationInput.tsx'
import SourceTypeSelector from './SourceTypeSelector.tsx'
import useInternetAccounts from './useInternetAccounts.ts'
import { addAccountToLocation, getInitialSourceType } from './util.ts'
import { notEmpty } from '../../util/index.ts'
import { isUriLocation } from '../../util/types/index.ts'

import type { AbstractRootModel, FileLocation } from '../../util/types/index.ts'

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
}) {
  const [sourceType, setSourceType] = useState(() =>
    getInitialSourceType(location),
  )

  const {
    accountMap,
    shownAccountIds,
    hiddenAccountIds,
    recentlyUsed,
    setRecentlyUsed,
  } = useInternetAccounts(rootModel)

  const selectedAccount = accountMap[sourceType]

  const handleLocationChange = useCallback(
    (loc: FileLocation) => {
      setLocation(addAccountToLocation(loc, selectedAccount))
    },
    [setLocation, selectedAccount],
  )

  // Sync account ID to location when account selection changes
  useEffect(() => {
    if (
      selectedAccount &&
      isUriLocation(location) &&
      location.internetAccountId !== selectedAccount.internetAccountId
    ) {
      handleLocationChange(location)
    }
  }, [location, selectedAccount, handleLocationChange])

  const handleSourceTypeChange = useCallback(
    (newValue: string | null) => {
      if (newValue) {
        setRecentlyUsed([
          ...new Set([newValue, ...recentlyUsed].filter(notEmpty)),
        ])
        setSourceType(newValue)
        if (isUriLocation(location)) {
          handleLocationChange(location)
        }
      }
    },
    [location, recentlyUsed, setRecentlyUsed, handleLocationChange],
  )

  return (
    <>
      <Box display="flex">
        <InputLabel shrink>{name}</InputLabel>
      </Box>
      <FormGroup>
        <Box display="flex" flexDirection={inline ? 'row' : 'column'} gap={0.5}>
          <SourceTypeSelector
            value={sourceType}
            shownAccountIds={shownAccountIds}
            hiddenAccountIds={hiddenAccountIds}
            accountMap={accountMap}
            onChange={(_event, newValue) => {
              handleSourceTypeChange(newValue)
            }}
            onHiddenAccountSelect={handleSourceTypeChange}
          />
          <LocationInput
            toggleButtonValue={sourceType}
            selectedAccount={selectedAccount}
            location={location}
            inline={inline}
            setLocation={handleLocationChange}
          />
        </Box>
      </FormGroup>
      <FormHelperText>{description}</FormHelperText>
    </>
  )
})

export default FileSelector
