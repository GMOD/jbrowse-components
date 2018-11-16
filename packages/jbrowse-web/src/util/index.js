import { openUrl } from './io/rangeFetcher'
import LocalFile from './io/localFile'

export function assembleLocString({ assembly, refName, start, end }) {
  return `${assembly}:${refName}:${start}-${end}`
}

export function openLocation(location) {
  if (location.uri) return openUrl(location.uri)
  if (location.path) {
    return new LocalFile(location.path)
  }
  throw new Error('local files not yet supported by openLocation')
}
