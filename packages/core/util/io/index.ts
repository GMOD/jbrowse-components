import { LocalFile, BlobFile, GenericFilehandle } from 'generic-filehandle'
import ElectronLocalFile from './ElectronLocalFile'
import { openUrl as rangeFetcherOpenUrl } from './rangeFetcher'

export const openUrl = rangeFetcherOpenUrl

const isElectron = (): boolean => {
  // @ts-ignore
  return true
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function openLocation(location: any): GenericFilehandle {
  if (!location) throw new Error('must provide a location to openLocation')
  if (location.uri) return openUrl(location.uri)
  if (location.localPath) {
    if (isElectron()) return new ElectronLocalFile(location.localPath)
    return new LocalFile(location.localPath)
  }
  if (location.blob) return new BlobFile(location.blob)
  throw new Error('invalid fileLocation')
}
