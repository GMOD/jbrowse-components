import { isObject } from './objectUtils.ts'
import { isUriLocation } from './types/index.ts'

function getUriLink(value: { uri: string; baseUri?: string }) {
  const { uri, baseUri = '' } = value
  let href: string
  try {
    href = new URL(uri, baseUri).href
  } catch {
    href = uri
  }
  return href
}

/**
 * A value rendered as a display string: a UriLocation as its resolved href, any
 * other object as JSON, everything else via String(). Shared by the DataGrid
 * column-width heuristic and the feature-detail panels.
 */
export function getStr(obj: unknown) {
  return isObject(obj)
    ? isUriLocation(obj)
      ? getUriLink(obj)
      : JSON.stringify(obj)
    : String(obj)
}
