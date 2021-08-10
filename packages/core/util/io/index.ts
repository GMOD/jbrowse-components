import { BlobFile, GenericFilehandle } from 'generic-filehandle'
import LocalFile from './LocalFile'
import { openUrl as rangeFetcherOpenUrl } from './rangeFetcher'
import {
  FileLocation,
  LocalPathLocation,
  UriLocation,
  BlobLocation,
} from '../types'
import { getBlob, getAuthenticationInfo } from '../tracks'
import { isElectron } from '../../util'

export const openUrl = (arg: string, headers?: HeadersInit) => {
  return rangeFetcherOpenUrl(arg, headers)
}

function isUriLocation(location: FileLocation): location is UriLocation {
  return 'uri' in location
}

function isLocalPathLocation(
  location: FileLocation,
): location is LocalPathLocation {
  return 'localPath' in location
}

function isBlobLocation(location: FileLocation): location is BlobLocation {
  return 'blobId' in location
}

// needs to take the rootmodel in as an optional parameter, use if there is no preauth information
// calls that arent in data-adapters would need the rootmodel param added, main thread stuff
export function openLocation(
  location: FileLocation,
  rootModel?: any,
): GenericFilehandle {
  if (!location) {
    throw new Error('must provide a location to openLocation')
  }
  if (isLocalPathLocation(location)) {
    if (!location.localPath) {
      throw new Error('No local path provided')
    }
  } else {
    if (isUriLocation(location)) {
      if (!location.uri) {
        throw new Error('No URI provided')
      }

      // new block, check if location is associated with an internetAccountId
      // if there isnt preauth information, call the rootmodel to find appropriate internetaccount id and get the auth flow running
      // which should return the authentications openLocation
      // if it is, get the authentication location, and return the authentication's openLocation
      if (location.internetAccountId) {
        // if (!location.internetAccountPreAuthorization) {
        //   rootModel.findAppropriateInternetAccount(location)
        // }
        console.log(location)
        // current progress: need to somehow call the authentication's open location
        return location.internetAccountPreAuthorization?.authInfo.openLocation
      }
      return openUrl(
        location.baseUri
          ? new URL(location.uri, location.baseUri).href
          : location.uri,
      )
    }
    if (isLocalPathLocation(location)) {
      // @ts-ignore
      if (!location.localPath) {
        throw new Error('No local path provided')
      }
      if (isElectron || typeof jest !== 'undefined') {
        // @ts-ignore
        return new LocalFile(location.localPath)
      }
    } else {
      throw new Error("can't use local files in the browser")
    }
  }
  if (isUriLocation(location)) {
    // @ts-ignore
    if (!location.uri) {
      throw new Error('No URI provided')
    }
    return openUrl(
      // @ts-ignore
      location.baseUri
        ? // @ts-ignore
          new URL(location.uri, location.baseUri).href
        : // @ts-ignore
          location.uri,
    )
  }
  if (isBlobLocation(location)) {
    // special case where blob is not directly stored on the model, use a getter
    // @ts-ignore
    const blob = getBlob(location.blobId)
    if (!blob) {
      throw new Error(
        // @ts-ignore
        `file ("${location.name}") was opened locally from a previous session. To restore it, go to track settings and reopen the file`,
      )
    }
    return new BlobFile(blob)
  }
  throw new Error('invalid fileLocation')
}
