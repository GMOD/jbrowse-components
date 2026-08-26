import { useCallback, useId, useState } from 'react'

import { Box, FormHelperText, InputLabel } from '@mui/material'
import { observer } from 'mobx-react'

import { notEmpty } from '../../util/index.ts'
import { isUriLocation } from '../../util/types/index.ts'
import LocationInput from './LocationInput.tsx'
import SourceTypeSelector from './SourceTypeSelector.tsx'
import { useEmptySourceType } from './emptySourceType.ts'
import useInternetAccounts from './useInternetAccounts.ts'
import {
  addAccountToLocation,
  availableSourceTypes,
  getInitialSourceType,
  sourceTypeForLocation,
} from './util.ts'

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
  const emptySourceType = useEmptySourceType()
  const labelId = useId()
  const descriptionId = useId()
  const [sourceType, setSourceType] = useState(() =>
    getInitialSourceType(location, emptySourceType),
  )
  const {
    accountMap,
    shownAccounts,
    hiddenAccounts,
    recentlyUsed,
    setRecentlyUsed,
  } = useInternetAccounts(rootModel)

  // What a location wants and what the group draws are answered separately, so
  // they have to be reconciled somewhere: a selection no button carries leaves
  // the group with nothing pressed. Derived rather than clamped into state, so
  // an account that installs after this mounted takes its selection back.
  const sourceTypes = availableSourceTypes(Object.keys(accountMap))
  const shownSourceType = sourceTypes.includes(sourceType) ? sourceType : 'url'

  // A location the form filled in for the user has to be able to show itself.
  // The toggle is picked once, at mount, from a slot that is usually still
  // empty, so an index detected beside the main file went into the model and
  // rendered as a blank box — under a note saying it had been filled in. Only a
  // location the showing toggle CANNOT render moves it, so this never overrides
  // a toggle the user picked for a slot they are still filling.
  const [lastLocation, setLastLocation] = useState(location)
  if (location !== lastLocation) {
    setLastLocation(location)
    const needed = sourceTypeForLocation(location, shownSourceType)
    if (needed) {
      setSourceType(needed)
    }
  }

  const selectedAccount = accountMap[shownSourceType]

  const handleLocationChange = useCallback(
    (loc: FileLocation) => {
      setLocation(addAccountToLocation(loc, selectedAccount))
    },
    [setLocation, selectedAccount],
  )

  const handleSourceTypeChange = useCallback(
    (newValue: string | null) => {
      if (!newValue) {
        return
      }
      setRecentlyUsed([
        ...new Set([newValue, ...recentlyUsed].filter(notEmpty)),
      ])
      setSourceType(newValue)
      // re-stamp an existing URL for the source type just chosen — the account
      // it names, or none at all if it names none. Read from accountMap rather
      // than the closed-over selectedAccount, which still reflects the source
      // type being left.
      if (location && isUriLocation(location)) {
        const next = addAccountToLocation(location, accountMap[newValue])
        if (next !== location) {
          setLocation(next)
        }
      }
    },
    [location, recentlyUsed, setRecentlyUsed, accountMap, setLocation],
  )

  return (
    <>
      <Box sx={{ display: 'flex' }}>
        <InputLabel id={labelId} shrink>
          {name}
        </InputLabel>
      </Box>
      {/* The name and description belong to the toggle-plus-input pair, not to
          either half, so the pair is the group they name. The InputLabel here
          is not `htmlFor` anything and cannot be: what it labels is a URL box
          in one branch and a Choose File button in another, and on the web that
          button is itself a <label> around a hidden input. Without this, every
          selector on a form announces as "Enter URL" and a reader has no way to
          tell the .fai from the .gzi from the cytobands. */}
      <Box
        role="group"
        aria-labelledby={name ? labelId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        sx={{
          display: 'flex',
          flexDirection: inline ? 'row' : 'column',
          gap: 0.5,
        }}
      >
        <SourceTypeSelector
          value={shownSourceType}
          sourceTypes={sourceTypes}
          shownAccounts={shownAccounts}
          hiddenAccounts={hiddenAccounts}
          onChange={(_event, newValue) => {
            handleSourceTypeChange(newValue)
          }}
          onHiddenAccountSelect={handleSourceTypeChange}
        />
        <LocationInput
          toggleButtonValue={shownSourceType}
          selectedAccount={selectedAccount}
          location={location}
          inline={inline}
          setLocation={handleLocationChange}
        />
      </Box>
      <FormHelperText id={descriptionId}>{description}</FormHelperText>
    </>
  )
})

export default FileSelector
