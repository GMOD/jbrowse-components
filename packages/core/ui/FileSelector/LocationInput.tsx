import LocalFileChooser from './LocalFileChooser'
import UrlChooser from './UrlChooser'

import type { BaseInternetAccountModel } from '../../pluggableElementTypes'
import type { FileLocation } from '../../util/types'

export default function LocationInput({
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
        location={location}
        setLocation={setLocation}
        label={selectedAccount?.selectorLabel}
        style={inline ? { margin: 0 } : undefined}
      />
    )
  }
  if (toggleButtonValue === 'file') {
    return <LocalFileChooser location={location} setLocation={setLocation} />
  }
  return null
}
