import { LocalFile, BlobFile, GenericFilehandle } from 'generic-filehandle'
import ElectronLocalFile from './ElectronLocalFile'
import ElectronRemoteFile from './ElectronRemoteFile'
import { openUrl as rangeFetcherOpenUrl } from './rangeFetcher'
import {
  FileLocation,
  LocalPathLocation,
  UriLocation,
  BlobLocation,
} from '../types'
import { getBlob } from '../tracks'
import { isElectron } from '../../util'

declare global {
  interface Window {
    electron?: import('electron').AllElectron
  }
}

export const openUrl = (arg: string) => {
  return isElectron ? new ElectronRemoteFile(arg) : rangeFetcherOpenUrl(arg)
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

export function openLocation(location: FileLocation): GenericFilehandle {
  if (!location) {
    throw new Error('must provide a location to openLocation')
  }
  if (isElectron) {
    if (isUriLocation(location)) {
      return new ElectronRemoteFile(location.uri)
    }
    if (isLocalPathLocation(location)) {
      return new ElectronLocalFile(location.localPath)
    }
  } else {
    if (isUriLocation(location)) {
      return openUrl(
        location.baseUri
          ? new URL(location.uri, location.baseUri).href
          : location.uri,
      )
    }
    if (isLocalPathLocation(location)) {
      return new LocalFile(location.localPath)
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
  throw new Error('invalid fileLocation')
}
