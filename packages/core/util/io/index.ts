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

export const openUrl = rangeFetcherOpenUrl

declare global {
  interface Window {
    electron?: import('electron').AllElectron
  }
}

const isElectron = !!window.electron

function isUriLocation(location: FileLocation): location is UriLocation {
  return 'uri' in location
}

function isLocalPathLocation(
  location: FileLocation,
): location is LocalPathLocation {
  return 'localPath' in location
}

function isBlobLocation(location: FileLocation): location is BlobLocation {
  return 'blob' in location
}

export function openLocation(location: FileLocation): GenericFilehandle {
  if (!location) throw new Error('must provide a location to openLocation')
  if (isElectron) {
    if (isUriLocation(location)) return new ElectronRemoteFile(location.uri)
    if (isLocalPathLocation(location))
      return new ElectronLocalFile(location.localPath)
  } else {
    if (isUriLocation(location)) return openUrl(location.uri)
    if (isLocalPathLocation(location)) return new LocalFile(location.localPath)
  }
  if (isBlobLocation(location)) return new BlobFile(location.blob)
  throw new Error('invalid fileLocation')
}
