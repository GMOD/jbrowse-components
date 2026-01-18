import isNode from 'detect-node'
import { BlobFile, LocalFile } from 'generic-filehandle2'

import { RemoteFileWithRangeCache } from './RemoteFileWithRangeCache.ts'
import { isElectron } from '../index.ts'
import { getBlob, getFileFromCache } from '../tracks.ts'
import {
  AuthNeededError,
  isFileHandleLocation,
  isRootModelWithInternetAccounts,
  isUriLocation,
} from '../types/index.ts'

import type PluginManager from '../../PluginManager.ts'
import type { BaseInternetAccountModel } from '../../pluggableElementTypes/models/index.ts'
import type {
  BlobLocation,
  FileHandleLocation,
  FileLocation,
  LocalPathLocation,
  UriLocation,
} from '../types/index.ts'
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

export function openLocation(
  location: FileLocation,
  pluginManager?: PluginManager,
): GenericFilehandle {
  if (isLocalPathLocation(location)) {
    if (!location.localPath) {
      throw new Error('No local path provided')
    }

    if (isNode || isElectron) {
      return new LocalFile(location.localPath)
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
    return new BlobFile(blob)
  }
  if (isFileHandleLocationLocal(location)) {
    // FileHandleLocation uses an in-memory cache of File objects
    // The cache is populated asynchronously via ensureFileHandleReady
    console.log(
      '[openLocation] FileHandleLocation detected, handleId:',
      location.handleId,
      'name:',
      location.name,
    )
    const file = getFileFromCache(location.handleId)
    if (!file) {
      console.error(
        '[openLocation] File not in cache for handleId:',
        location.handleId,
      )
      throw new Error(
        `file ("${location.name}") requires permission. Please reopen the file from track settings`,
      )
    }
    console.log('[openLocation] File found in cache:', file.name)
    return new BlobFile(file)
  }
  if (isUriLocation(location)) {
    // Check for empty string
    if (!location.uri) {
      throw new Error('No URI provided')
    }

    // Resolve any relative URLs to absolute URLs
    const absoluteLocation = resolveUriLocation(location)

    // If there is a plugin manager, we can try internet accounts
    if (pluginManager) {
      const internetAccount = getInternetAccount(location, pluginManager)
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

export function getFetcher(
  location: FileLocation,
  pluginManager?: PluginManager,
): Fetcher {
  if (!isUriLocation(location)) {
    throw new Error(`Not a valid UriLocation: ${JSON.stringify(location)}`)
  }
  if (pluginManager) {
    const internetAccount = getInternetAccount(location, pluginManager)
    if (internetAccount) {
      return internetAccount.getFetcher(location)
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
      )!
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

export { RemoteFileWithRangeCache } from './RemoteFileWithRangeCache.ts'
