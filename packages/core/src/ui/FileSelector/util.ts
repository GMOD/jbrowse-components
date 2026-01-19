import { isUriLocation } from '@jbrowse/core/util/index'

import type { BaseInternetAccountModel } from '../../pluggableElementTypes/index.ts'
import type { FileLocation } from '@jbrowse/core/util/index'

export const MAX_LABEL_LENGTH = 5

export function isAdminMode() {
  return (
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('adminKey') !== null
  )
}

export function shorten(str: string) {
  return str.length > MAX_LABEL_LENGTH
    ? `${str.slice(0, MAX_LABEL_LENGTH)}…`
    : str
}

export function getAccountLabel(account: BaseInternetAccountModel) {
  const { toggleContents, name } = account
  if (toggleContents) {
    return typeof toggleContents === 'string'
      ? shorten(toggleContents)
      : toggleContents
  }
  return shorten(name)
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

export function addAccountToLocation(
  location: FileLocation,
  account?: BaseInternetAccountModel,
): FileLocation {
  if (account && isUriLocation(location)) {
    return { ...location, internetAccountId: account.internetAccountId }
  }
  return location
}
