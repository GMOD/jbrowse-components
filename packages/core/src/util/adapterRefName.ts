/**
 * #api core/util
 * A refName in a data file's own spelling that names a location the request
 * did not ask for: a mate, a supplementary alignment, a synteny target
 * (`agent-docs/reference/REFNAME_NAMESPACES.md`). A plain string at runtime.
 *
 * Deliberately not a `string` subtype, so it cannot meet a canonical name
 * unconverted: comparing it with a string is TS2367, and handing it to a
 * `string` parameter, a `Map<string, _>` or a `Record<string, _>` is TS2345 or
 * TS2538. `canonicalAdapterRefName` converts it, `adapterRefNameText` spells it.
 */
export interface AdapterRefName {
  readonly __refNameNamespace: 'adapter'
}

/**
 * #api core/util
 * Mints the brand where a file's name for an out-of-request location is first
 * read.
 */
export function adapterRefName(refName: string) {
  return refName as unknown as AdapterRefName
}

/**
 * #api core/util
 * The file's spelling as text, for display or for handing back to the adapter
 * that spelled it. Not for comparing with view state.
 */
export function adapterRefNameText(refName: AdapterRefName) {
  return refName as unknown as string
}

/**
 * #api core/util
 * The assembly's canonical name for an adapter-spelled refName, through
 * `getCanonicalRefName2`; the file's spelling when there is no assembly.
 */
export function canonicalAdapterRefName(
  assembly: { getCanonicalRefName2: (refName: string) => string } | undefined,
  refName: AdapterRefName,
) {
  const text = adapterRefNameText(refName)
  return assembly ? assembly.getCanonicalRefName2(text) : text
}
