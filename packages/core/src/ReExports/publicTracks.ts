// The published `@jbrowse/core/util/tracks` module, listed by name. Same split,
// and the same reasons, as publicUtil.ts: serving `import * as trackUtils from
// '../util/tracks.ts'` made the external ABI a side effect of an internal
// module, so moving a helper out of tracks.ts silently edited what plugins get.
// `getParentRenderProps` left that way -- deleted as dead in-tree code, which it
// was, while published apollo called it on three display models.
//
// Unlike publicUi.tsx this one is served in the RPC worker too (sharedModules.ts),
// so it stays React-free; sharedModules.purity.test.ts fails on the graph, not
// on this list.
//
// So: adding a line is how a helper becomes public, and it is a decision rather
// than a side effect of where the code happens to live.
export {
  UNKNOWN,
  UNSUPPORTED,
  addAdapterGuesser,
  addTrackTypeGuesser,
  allSessionTracks,
  annotationTrackIds,
  canonicalAssemblyNames,
  clearFileFromCache,
  ensureFileHandleReady,
  expandLooseTrackConfig,
  findFileHandleIds,
  generateUnknownTrackConf,
  generateUnsupportedTrackConf,
  getBlob,
  getBlobMap,
  getConfAssemblyNames,
  getConfAssemblyNamesOrNone,
  getFileFromCache,
  getFileName,
  getRpcSessionId,
  getTrackAssemblyNames,
  getTrackName,
  guessAdapter,
  guessTabixIndex,
  guessTrackConf,
  guessTrackConfForLocation,
  guessTrackType,
  hasFileHandlesInCache,
  hideTrackGeneric,
  isLooseTrackConfig,
  isSameAssemblyName,
  launchToggleTrackGeneric,
  launchTrackGeneric,
  makeIndex,
  makeIndexType,
  normalizeTrackInit,
  openAssemblyInLinearView,
  openMateLabel,
  pickDisplayForView,
  restoreFileHandles,
  restoreFileHandlesFromSnapshot,
  setBlobMap,
  setFileInCache,
  showTrackGeneric,
  storeBlobLocation,
  storeFileHandleLocation,
  stripFileExtension,
  stripTrackIds,
  toggleTrackGeneric,
  viewCanDisplayTrack,
  viewDisplayNames,
} from '../util/tracks.ts'
