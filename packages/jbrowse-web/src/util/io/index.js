import { openUrl } from './rangeFetcher'
import LocalFile from './localFile'

// eslint-disable-next-line import/prefer-default-export
export function openLocation(location) {
  if (!location) throw new Error(`must provide a location to openLocation`)
  if (location.uri) return openUrl(location.uri)
  if (location.path) {
    return new LocalFile(location.path)
  }
  throw new Error('invalid fileLocation')
}
