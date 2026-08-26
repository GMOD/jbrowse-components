import { isUriLocation } from '../../util/index.ts'

import type { BaseInternetAccountModel } from '../../pluggableElementTypes/index.ts'
import type { FileLocation } from '../../util/index.ts'

export const MAX_LABEL_LENGTH = 5

// jbrowse-web keeps its URL params in the hash fragment XOR the query string
// (the long/json share modes put every param in the hash, which is never sent to
// the server and so can't trip the request-line limit), and its own loader reads
// `adminKey` from whichever the URL uses. Reading only `search` here made the two
// disagree on a hash-form URL: the root model is in admin mode, but the file
// picker still offers "File", whose BlobLocation cannot be written into the
// config.json the admin server saves.
//
// The hash/search rule must stay identical to jbrowse-web's canonical reader
// (`useQueryParam.ts` `paramLocation`).
export function isAdminMode() {
  if (typeof window === 'undefined') {
    return false
  }
  const hash = window.location.hash.slice(1)
  const params = new URLSearchParams(
    hash.includes('=') ? hash : window.location.search,
  )
  return params.get('adminKey') !== null
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

/**
 * The toggles a selector offers, in the order it draws them — and so the set a
 * selection has to come from.
 *
 * One list because three places used to answer this apart, and a selection none
 * of the drawn buttons carries leaves the group with nothing pressed:
 * `SourceTypeSelector` withheld File in admin mode while `getInitialSourceType`
 * went on opening an empty slot on it, and a location whose `internetAccountId`
 * names an account this host does not install opened on a toggle that was never
 * drawn. `FileSelector` resolves against this rather than trusting either.
 *
 * No File toggle in admin mode: a BlobLocation cannot be written into the
 * config.json the admin server saves.
 */
export function availableSourceTypes(accountIds: string[]) {
  return [...(isAdminMode() ? [] : ['file']), 'url', ...accountIds]
}

// Which toggle a selector opens on. A form's empty slot is spelled as a
// UriLocation with an empty uri, which isUriLocation rejects, so an untouched
// field falls to `emptyDefault` rather than reading as a URL. A form that knows
// how its user is working passes the answer: the add-genome pane's index inputs
// sit directly under a box of pasted URLs, and offering a local file picker
// there is a question already answered.
//
// What the location WANTS, which is not the same as what is on offer —
// `availableSourceTypes` is the other half, and `FileSelector` is where the two
// meet.
export function getInitialSourceType(
  location?: FileLocation,
  emptyDefault = 'file',
) {
  if (
    location &&
    'internetAccountId' in location &&
    location.internetAccountId
  ) {
    return location.internetAccountId
  }
  if (!location) {
    return 'url'
  }
  return isUriLocation(location)
    ? 'url'
    : 'uri' in location
      ? emptyDefault
      : 'file'
}

/**
 * The toggle `location` needs in order to be visible, or undefined when the one
 * already showing can render it.
 *
 * `getInitialSourceType` answers this once, at mount, when a form's slot is
 * usually still empty. This is the same question asked of a location that
 * arrived later — the index a form found sitting beside the main file, say,
 * which on desktop is a local path and would render as a blank URL box.
 *
 * Undefined for an empty slot (spelled as a UriLocation with no uri) as well as
 * for a match: an emptied field says nothing about how the user wants to work,
 * and switching the toggle out from under them as they clear a box is worse than
 * leaving it.
 */
export function sourceTypeForLocation(
  location: FileLocation | undefined,
  current: string,
) {
  if (!location) {
    return undefined
  }
  if (isUriLocation(location)) {
    // 'file' is the only toggle that cannot show a URL; the account toggles
    // render the same box, and one carrying a stamp is already on its own
    const wanted = location.internetAccountId ?? 'url'
    return current === 'file' ? wanted : undefined
  }
  return 'uri' in location || current === 'file' ? undefined : 'file'
}

/**
 * The directory containing `filePath`, for remembering where the user last
 * picked a file. Undefined when there is no directory to remember.
 *
 * String surgery rather than `node:path` because this is renderer code that
 * also builds for the web, and it has to read a Windows path from Electron
 * either way. Which means keeping the separator: `idx` is the index of the last
 * one, so slicing *before* it drops it, and `C:\reads.bam` — a file at the root
 * of a data drive, which is where an external disk mounts — yielded `"C:"`.
 * That is not the root; to Windows a drive letter with no separator means the
 * current directory on that drive, so the dialog reopened wherever the process
 * happened to be. Keep the separator when dropping it would leave a bare root
 * (`C:\`, and `/` on POSIX).
 */
export function dirFromPath(filePath: string) {
  const idx = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  if (idx === -1) {
    return undefined
  }
  const dir = filePath.slice(0, idx)
  // `C:` (drive-relative) or `` (posix root) — both need the separator back
  return /^[a-zA-Z]:$/.test(dir) || dir === ''
    ? filePath.slice(0, idx + 1)
    : dir
}

/**
 * Stamps the selected account onto a URL location — and, given no account,
 * *unstamps* whichever one was there. The second half is the one that matters:
 * picking Dropbox and then going back to plain URL used to leave the stamp
 * behind, so the file kept being fetched through Dropbox with nothing in the
 * form saying so.
 *
 * Returns the location itself when there is nothing to change, so a caller can
 * tell a real edit from a no-op by identity.
 */
export function addAccountToLocation(
  location: FileLocation,
  account?: BaseInternetAccountModel,
): FileLocation {
  if (!isUriLocation(location)) {
    return location
  }
  const internetAccountId = account?.internetAccountId
  if (location.internetAccountId === internetAccountId) {
    return location
  }
  const { internetAccountId: _previous, ...rest } = location
  return internetAccountId ? { ...rest, internetAccountId } : rest
}
