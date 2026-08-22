/**
 * The signature-based analog of the spatial `viewportWithinLoadedData`
 * (MultiRegionDisplayMixin) freshness check, for a display whose liveness is one
 * string rather than a per-region coverage map. An `undefined` loaded signature
 * is nothing fetched yet, so never current.
 */
export function isDataCurrent(
  loadedSignature: string | undefined,
  currentSignature: string | undefined,
) {
  return loadedSignature !== undefined && loadedSignature === currentSignature
}
