import LocalFileChooser from './LocalFileChooser'
import UrlChooser from './UrlChooser'

import type { BaseInternetAccountModel } from '../../pluggableElementTypes'
import type { FileLocation } from '../../util/types'

export default function LocationInput({
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
