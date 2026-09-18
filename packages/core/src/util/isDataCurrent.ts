import { compareStructural } from 'mobx'

/**
 * Whether the key held data was committed under still equals the key a fetch
 * issued now would carry. Keys are values compared structurally, so a stamp
 * that kept its identity short-circuits on `===`, and an `undefined`-valued
 * field or a fieldless class instance is still a distinct state — the two
 * shapes `JSON.stringify` flattened. An `undefined` loaded key is nothing
 * fetched yet, so never current.
 */
export function isDataCurrent(loaded: unknown, current: unknown) {
  return loaded !== undefined && compareStructural(loaded, current)
}
