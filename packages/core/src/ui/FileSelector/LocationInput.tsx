import { useState } from 'react'

import { Button } from '@mui/material'
import { observer } from 'mobx-react'

import ErrorMessage from '../ErrorMessage.tsx'
import LocalFileChooser from './LocalFileChooser.tsx'
import UrlChooser from './UrlChooser.tsx'

import type { BaseInternetAccountModel } from '../../pluggableElementTypes/index.ts'
import type { FileLocation } from '../../util/types/index.ts'

const BrowseButton = observer(function BrowseButton({
  account,
  label,
  setLocation,
}: {
  account: BaseInternetAccountModel
  label: string
  setLocation: (arg: FileLocation) => void
}) {
  const [error, setError] = useState<unknown>()
  return (
    <>
      <Button
        variant="outlined"
        onClick={() => {
          setError(undefined)
          account
            .chooseLocation()
            .then(location => {
              if (location) {
                setLocation(location)
              }
            })
            .catch((e: unknown) => {
              console.error(e)
              setError(e)
            })
        }}
      >
        {label}
      </Button>
      {error ? <ErrorMessage error={error} /> : null}
    </>
  )
})

const LocationInput = observer(function LocationInput({
  toggleButtonValue,
  selectedAccount,
  location,
  inline,
  setLocation,
}: {
  toggleButtonValue: string
  selectedAccount?: BaseInternetAccountModel
  location?: FileLocation
  inline?: boolean
  setLocation: (arg: FileLocation) => void
}) {
  // `file` is the only toggle with an input of its own — URL and every account
  // toggle share the URL box, which is what `selectorLabel` names. Anything
  // else falling through to `null` drew a field label and a toggle group with
  // nothing under them: picking Dropbox did it, and so did a location arriving
  // already stamped with an `internetAccountId`.
  const browseLabel = selectedAccount?.browseLabel
  return toggleButtonValue === 'file' ? (
    <LocalFileChooser location={location} setLocation={setLocation} />
  ) : (
    <>
      <UrlChooser
        location={location}
        setLocation={setLocation}
        label={selectedAccount?.selectorLabel}
        style={inline ? { margin: 0 } : undefined}
      />
      {selectedAccount && browseLabel ? (
        <BrowseButton
          account={selectedAccount}
          label={browseLabel}
          setLocation={setLocation}
        />
      ) : null}
    </>
  )
})

export default LocationInput
