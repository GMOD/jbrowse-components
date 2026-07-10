// A comparative-view display tags its fetched data with the fetch-input
// signature it was loaded for (see each view's `currentFetchKey`), then gates
// `svgReady`/`settled` on this predicate. The held data is "current" only when
// its loaded signature matches the view's live one; an undefined loaded key
// means nothing has been fetched yet, so it is never current. Shared by dotplot
// and linear-comparative synteny so the freshness rule can't drift between them.
export function isDataCurrent(
  loadedFetchKey: string | undefined,
  currentFetchKey: string | undefined,
) {
  return loadedFetchKey !== undefined && loadedFetchKey === currentFetchKey
}
