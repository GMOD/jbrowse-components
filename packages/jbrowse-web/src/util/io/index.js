import { openUrl } from './rangeFetcher'
import LocalFile from './localFile'

// eslint-disable-next-line import/prefer-default-export
export function openLocation(location) {
  if (!location) throw new Error(`must provide a location to openLocation`)
  if (location.uri) return openUrl(location.uri)
  if (location.localPath) {
    return new LocalFile(location.localPath)
  }
  throw new Error('invalid fileLocation')
}
