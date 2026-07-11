import { useCallback, useState } from 'react'

import { Box, FormHelperText, InputLabel } from '@mui/material'
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
    shownAccounts,
    hiddenAccounts,
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

  const handleSourceTypeChange = useCallback(
    (newValue: string | null) => {
      if (newValue) {
        setRecentlyUsed([
          ...new Set([newValue, ...recentlyUsed].filter(notEmpty)),
        ])
        setSourceType(newValue)
        // stamp the newly-selected account onto an existing URL; read it from
        // accountMap[newValue] rather than the closed-over selectedAccount,
        // which still reflects the pre-change source type
        const account = accountMap[newValue]
        if (account && isUriLocation(location)) {
          setLocation(addAccountToLocation(location, account))
        }
      }
    },
    [location, recentlyUsed, setRecentlyUsed, accountMap, setLocation],
  )

  return (
    <>
      <Box sx={{ display: 'flex' }}>
        <InputLabel shrink>{name}</InputLabel>
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: inline ? 'row' : 'column',
          gap: 0.5,
        }}
      >
        <SourceTypeSelector
          value={sourceType}
          shownAccounts={shownAccounts}
          hiddenAccounts={hiddenAccounts}
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
      <FormHelperText>{description}</FormHelperText>
    </>
  )
})

export default FileSelector
