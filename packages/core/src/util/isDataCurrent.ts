/**
 * Freshness predicate for displays whose data liveness is a single signature
 * string rather than a per-region spatial-coverage map: dotplot +
 * linear-comparative synteny (a fetch-input signature) and arc / paired-arc (a
 * static-block region-key signature). Each tags its held data with the
 * signature it was loaded for, then a readiness gate — `svgReady` for off-screen
 * export, `settled` for on-screen capture — calls this to decide whether that
 * data is still current for what is on screen now.
 *
 * The held data is current only when its loaded signature matches the live one;
 * an `undefined` loaded signature means nothing has been fetched yet, so it is
 * never current. Defined once here so the rule can't drift across the four
 * displays that share it — the signature-based analog of the spatial
 * `viewportWithinLoadedData` (MultiRegionDisplayMixin) and `viewportMatchesLastDrawn`
 * (GlobalDataDisplayMixin) freshness checks.
 */
export function isDataCurrent(
  loadedSignature: string | undefined,
  currentSignature: string | undefined,
) {
  return loadedSignature !== undefined && loadedSignature === currentSignature
}
