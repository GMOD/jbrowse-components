import { isUriLocation } from '../../util/index.ts'

import type { BaseInternetAccountModel } from '../../pluggableElementTypes/index.ts'
import type { FileLocation } from '../../util/index.ts'

export const MAX_LABEL_LENGTH = 5

export function isAdminMode() {
  return (
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('adminKey') !== null
  )
}

// Truncate a file/account label at the tail. Distinct from the core
// `shorten`, which elides the MIDDLE of a long name to keep both ends legible
// — here the leading characters are the identifying part.
export function truncateLabel(str: string) {
  return str.length > MAX_LABEL_LENGTH
    ? `${str.slice(0, MAX_LABEL_LENGTH)}…`
    : str
}

export function getAccountLabel(account: BaseInternetAccountModel) {
  const { toggleContents, name } = account
  if (toggleContents) {
    return typeof toggleContents === 'string'
      ? truncateLabel(toggleContents)
      : toggleContents
  }
  return truncateLabel(name)
}

export function getInitialSourceType(location?: FileLocation) {
  if (
    location &&
    'internetAccountId' in location &&
    location.internetAccountId
  ) {
    return location.internetAccountId
  }
  return !location || isUriLocation(location) ? 'url' : 'file'
}

export function dirFromPath(filePath: string) {
  const idx = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return idx > 0 ? filePath.slice(0, idx) : undefined
}

export function addAccountToLocation(
  location: FileLocation,
  account?: BaseInternetAccountModel,
): FileLocation {
  if (account && isUriLocation(location)) {
    return { ...location, internetAccountId: account.internetAccountId }
  }
  return location
}
