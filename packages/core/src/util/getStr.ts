import { resolveUri } from './getLocationUri.ts'
import { isObject } from './objectUtils.ts'
import { isUriLocation } from './types/index.ts'

/**
 * A value rendered as a display string: a UriLocation as its resolved href, any
 * other object as JSON, everything else via String(). Shared by the DataGrid
 * column-width heuristic and the feature-detail panels.
 */
export function getStr(obj: unknown) {
  return isObject(obj)
    ? isUriLocation(obj)
      ? resolveUri(obj)
      : JSON.stringify(obj)
    : String(obj)
}
