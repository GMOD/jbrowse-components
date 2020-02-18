import { LocalFile, BlobFile, GenericFilehandle } from 'generic-filehandle'
import ElectronLocalFile from './ElectronLocalFile'
import ElectronRemoteFile from './ElectronRemoteFile'
import { openUrl as rangeFetcherOpenUrl } from './rangeFetcher'
import {
  IFileLocation,
  ILocalPathLocation,
  IUriLocation,
  IBlobLocation,
} from '../../mst-types'

export const openUrl = rangeFetcherOpenUrl

declare global {
  interface Window {
    electron?: import('electron').AllElectron
  }
}

const isElectron = !!window.electron

function isUriLocation(location: IFileLocation): location is IUriLocation {
  return (location as IUriLocation).uri !== undefined
}

function isLocalPathLocation(
  location: IFileLocation,
): location is ILocalPathLocation {
  return (location as ILocalPathLocation).localPath !== undefined
}

function isBlobLocation(location: IFileLocation): location is IBlobLocation {
  return (location as IBlobLocation).blob !== undefined
}

export function openLocation(location: IFileLocation): GenericFilehandle {
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
  debugger
  throw new Error('invalid fileLocation')
}
