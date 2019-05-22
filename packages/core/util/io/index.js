import { LocalFile, BlobFile } from 'generic-filehandle'
import { openUrl } from './rangeFetcher'

export { openUrl }

export function openLocation(location) {
  if (!location) throw new Error('must provide a location to openLocation')
  if (location.uri) return openUrl(location.uri)
  if (location.localPath) {
    return new LocalFile(location.localPath)
  }
  if (location.blob) return new BlobFile(location.blob)
  throw new Error('invalid fileLocation')
}
