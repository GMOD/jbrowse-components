import { BlobFile, LocalFile } from 'generic-filehandle2'

import { isElectron, isNode } from '../environment.ts'
import { getBlob, getFileFromCache } from '../tracks.ts'
import {
  AuthNeededError,
  isRootModelWithInternetAccounts,
  isUriLocation,
} from '../types/index.ts'
import {
  CachedFilehandle,
  RemoteFileWithRangeCache,
} from './RemoteFileWithRangeCache.ts'

import type PluginManager from '../../PluginManager.ts'
import type { BaseInternetAccountModel } from '../../pluggableElementTypes/models/index.ts'
import type {
  BlobLocation,
  FileHandleLocation,
  FileLocation,
  LocalPathLocation,
  UriLocation,
} from '../types/data.ts'
import type { Fetcher, GenericFilehandle } from 'generic-filehandle2'

function isLocalPathLocation(
  location: FileLocation,
): location is LocalPathLocation {
  return 'localPath' in location
}

function isBlobLocation(location: FileLocation): location is BlobLocation {
  return 'blobId' in location
}

function isFileHandleLocationLocal(
  location: FileLocation,
): location is FileHandleLocation {
  return 'handleId' in location
}

/** if a UriLocation has a baseUri, resolves its uri with respect to that base */
export function resolveUriLocation(location: UriLocation) {
  return location.baseUri
    ? { ...location, uri: new URL(location.uri, location.baseUri).href }
    : location
}

/**
 * The local path a `file:` URI names, or undefined for any other scheme. A
 * Windows URL parses as `/C:/data/x.bam`, whose leading slash is part of the URL
 * grammar rather than the path.
 */
export function fileUrlToLocalPath(uri: string) {
  if (!uri.startsWith('file:')) {
    return undefined
  }
  try {
    const { pathname } = new URL(uri)
    const decoded = decodeURIComponent(pathname)
    return /^\/[a-z]:/i.test(decoded) ? decoded.slice(1) : decoded
  } catch {
    return undefined
  }
}

export function openLocation(
  location: FileLocation,
  pluginManager?: PluginManager,
): GenericFilehandle {
  if (isLocalPathLocation(location)) {
    if (!location.localPath) {
      throw new Error('No local path provided')
    }

    if (isNode || isElectron) {
      // Same chunk cache the remote path has always had. A local read is not
      // free — desktop re-read every byte of every pan — and the layer above
      // does not care where the bytes came from.
      return new CachedFilehandle(
        new LocalFile(location.localPath),
        `file://${location.localPath}`,
      )
    } else {
      throw new Error("can't use local files in the browser")
    }
  }
  if (isBlobLocation(location)) {
    // special case where blob is not directly stored on the model, use a getter
    const blob = getBlob(location.blobId)
    if (!blob) {
      throw new Error(
        `file ("${location.name}") was opened locally from a previous session. To restore it, go to track settings and reopen the file`,
      )
    }
    // keyed on the blobId rather than anything derived from the Blob: two
    // handles for the same session-stored blob should share chunks, and two
    // unrelated blobs must not
    return new CachedFilehandle(new BlobFile(blob), `blob://${location.blobId}`)
  }
  if (isFileHandleLocationLocal(location)) {
    // FileHandleLocation uses an in-memory cache of File objects
    // The cache is populated asynchronously via ensureFileHandleReady
    const file = getFileFromCache(location.handleId)
    if (!file) {
      throw new Error(
        `file ("${location.name}") requires permission. Please reopen the file from track settings`,
      )
    }
    return new CachedFilehandle(
      new BlobFile(file),
      `filehandle://${location.handleId}`,
    )
  }
  if (isUriLocation(location)) {
    // Check for empty string
    if (!location.uri) {
      throw new Error('No URI provided')
    }

    // Resolve any relative URLs to absolute URLs. Before *choosing* the account
    // and not only before opening: an account is matched on the location's host
    // or URL prefix, which a uri relative to a baseUri does not carry yet — so
    // a config that names its files relative to itself found no account at all
    // and read every one of them unauthenticated.
    const absoluteLocation = resolveUriLocation(location)

    // A file: URI names a path on this machine, not something to fetch. Desktop
    // reaches this by way of the shorthand forms: a config.json opened from disk
    // carries a baseUri of its own directory, so `{ type: 'BamAdapter', uri:
    // 'reads.bam' }` resolves here as file:///dir/reads.bam — and so does every
    // sibling the shorthand derived from it (.bai, .fai, .gzi). Reading them as
    // localPath keeps that whole chain on the one code path that can open a
    // local file, instead of a fetch that no range request survives.
    const localPath = fileUrlToLocalPath(absoluteLocation.uri)
    if (localPath !== undefined && (isNode || isElectron)) {
      return openLocation({ localPath, locationType: 'LocalPathLocation' })
    }

    // If there is a plugin manager, we can try internet accounts
    if (pluginManager) {
      const internetAccount = getInternetAccount(
        absoluteLocation,
        pluginManager,
      )
      // If an internetAccount was found, use it to open the location
      if (internetAccount) {
        return internetAccount.openLocation(absoluteLocation)
      }
    }
    // Otherwise fall back on usual open
    return new RemoteFileWithRangeCache(absoluteLocation.uri, {
      fetch: checkAuthNeededFetch,
    })
  }
  throw new Error('invalid fileLocation')
}

/**
 * Open a tabix-style index (TBI or CSI) and return it under the correct
 * filehandle key for `new TabixIndexedFile(...)`. Centralizes the CSI-vs-TBI
 * branch so callers can't mismatch the two — e.g. writing `=== 'CSI'` on both
 * the csi and tbi lines, which silently yields no index at all.
 */
export function openTabixIndexFilehandle(
  location: FileLocation,
  indexType: string | undefined,
  pluginManager?: PluginManager,
) {
  const filehandle = openLocation(location, pluginManager)
  return indexType === 'CSI'
    ? { csiFilehandle: filehandle }
    : { tbiFilehandle: filehandle }
}

export function getFetcher(
  location: FileLocation,
  pluginManager?: PluginManager,
): Fetcher {
  if (!isUriLocation(location)) {
    throw new Error(`Not a valid UriLocation: ${JSON.stringify(location)}`)
  }
  if (pluginManager) {
    // resolved for the same reason openLocation resolves before matching
    const absoluteLocation = resolveUriLocation(location)
    const internetAccount = getInternetAccount(absoluteLocation, pluginManager)
    if (internetAccount) {
      return internetAccount.getFetcher(absoluteLocation)
    }
  }
  return checkAuthNeededFetch
}

function getInternetAccount(
  location: UriLocation,
  pluginManager: PluginManager,
): BaseInternetAccountModel | undefined {
  const { rootModel } = pluginManager
  // If there is an appRootModel, use it to find the internetAccount
  if (rootModel && isRootModelWithInternetAccounts(rootModel)) {
    return rootModel.findAppropriateInternetAccount(location)
  }
  // If there is no appRootModel, but there is pre-auth, create a temporary
  // internetAccount. This is typical in a worker.
  if (location.internetAccountPreAuthorization) {
    if (!location.internetAccountPreAuthorization.authInfo.token) {
      throw new Error(
        'Failed to obtain token from internet account. Try reloading the page',
      )
    }
    return pluginManager
      .getInternetAccountType(
        location.internetAccountPreAuthorization.internetAccountType,
      )
      .stateModel.create({
        type: location.internetAccountPreAuthorization.internetAccountType,
        configuration:
          location.internetAccountPreAuthorization.authInfo.configuration,
      })
  }
  return undefined
}

// This fetch throws a special error if the response is "401" and includes a
// "WWW-Authenticate: Basic" header. This is so downstream code can retry if
// needed with HTTP Basic authentication included
async function checkAuthNeededFetch(url: RequestInfo, opts?: RequestInit) {
  const response = await fetch(url, opts)
  if (
    response.status === 401 &&
    response.headers.get('WWW-Authenticate')?.includes('Basic')
  ) {
    throw new AuthNeededError(
      'Accessing HTTPBasic resource without authentication',
      url.toString(),
    )
  }
  return response
}

export {
  CachedFilehandle,
  RemoteFileWithRangeCache,
} from './RemoteFileWithRangeCache.ts'
