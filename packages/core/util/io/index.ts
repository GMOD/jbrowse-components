import { LocalFile, BlobFile, GenericFilehandle } from 'generic-filehandle'
import { openUrl as rangeFetcherOpenUrl } from './rangeFetcher'

export const openUrl = rangeFetcherOpenUrl

export interface FileLocation {
  uri?: string
  localPath?: string
  blob?: Blob
}

export function openLocation(location: FileLocation): GenericFilehandle {
  if (!location) throw new Error('must provide a location to openLocation')
  if (location.uri) return openUrl(location.uri)
  if (location.localPath) {
    return new LocalFile(location.localPath)
  }
  if (location.blob) return new BlobFile(location.blob)
  throw new Error('invalid fileLocation')
}
