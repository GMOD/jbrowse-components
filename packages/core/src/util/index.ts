import { isElectron } from './environment.ts'
import { storeBlobLocation } from './tracks.ts'

import type { FileLocation } from './types/index.ts'

// `unzip` is deliberately NOT re-exported here — it lives at
// '@jbrowse/core/util/unzip' so this barrel does not reach bgzf/pako. See that
// file for why a re-export of it cannot be tree-shaken.
//
// Same weight, other direction: don't `await import('@jbrowse/core/util')` to
// defer something. A dynamic namespace request re-inflates what the named
// static imports tree-shook away — 231KB against 145KB, measured. Point the
// dynamic import at the module instead ('@jbrowse/core/svg/saveSvgAsImage').

export {
  capitalizeFirst,
  pluralize,
  shorten,
  shorten2,
  truncateMiddle,
} from './stringUtils.ts'
export { formatBytes } from './formatBytes.ts'
export { getFillProps, getStrokeProps, stripAlpha } from './svgColorProps.ts'
export {
  fetchAndMaybeUnzip,
  fetchAndMaybeUnzipText,
  isGzip,
} from './fetchAndMaybeUnzip.ts'

export {
  type AbstractDisplayModel,
  type AbstractMenuManager,
  type AbstractRootModel,
  type AbstractSessionModel,
  type AbstractTrackModel,
  type AbstractViewContainer,
  type AbstractViewModel,
  type AnimationMode,
  type AnyReactComponentType,
  type AppRootModel,
  type AssemblyManager,
  type AugmentedRegion,
  AuthNeededError,
  type BasePlugin,
  type BlobLocation,
  type ClassReturnedBy,
  type ConnectionInstance,
  type DialogComponentType,
  type FileHandleLocation,
  type FileLocation,
  type InstanceTypeRestrictive,
  type JBrowsePlugin,
  type JBrowsePluginVersion,
  type LocalPathLocation,
  type NoAssemblyRegion,
  type NotificationLevel,
  type PreBlobLocation,
  type PreFileHandleLocation,
  type PreFileLocation,
  type PreLocalPathLocation,
  type PreUriLocation,
  type Region,
  type RootModelWithInternetAccounts,
  type SelectionContainer,
  type SessionWithAddAssembly,
  type SessionWithAddSessionTrack,
  type SessionWithPublishTrackConf,
  type SessionWithConfigEditing,
  type SessionWithConnectionEditing,
  type SessionWithConnections,
  type SessionWithDeleteTrackConf,
  type SessionWithDrawerWidgets,
  type SessionWithFocusedViewAndDrawerWidgets,
  type SessionWithSessionPlugins,
  type SessionWithShareURL,
  type SessionWithViewReplacement,
  type SessionWithWidgets,
  type SnackAction,
  type TrackActionView,
  type TrackContainer,
  type TrackViewModel,
  type TypeTestedByPredicate,
  type UriLocation,
  type Widget,
  type WidgetMap,
  addOrReplaceView,
  canReplaceView,
  isAbstractMenuManager,
  isAppRootModel,
  isAuthNeededException,
  isBlobLocation,
  isDisplayModel,
  isFileHandleLocation,
  isLocalPathLocation,
  isRootModelWithInternetAccounts,
  isSelectionContainer,
  isSessionModel,
  isSessionModelWithConfigEditing,
  isSessionModelWithConnectionEditing,
  isSessionModelWithConnections,
  isSessionModelWithWidgets,
  isSessionWithAddAssembly,
  isSessionWithAddSessionTrack,
  isSessionWithAddTracks,
  isSessionWithPublishTrackConf,
  isSessionWithDeleteTrackConf,
  isSessionWithSessionPlugins,
  isSessionWithSessionTracks,
  isSessionWithShareURL,
  isSessionWithViewReplacement,
  isTrackModel,
  isTrackViewModel,
  isUriLocation,
  isViewContainer,
  isViewModel,
} from './types/index.ts'
export {
  type PluginUpdate,
  type ResolvedPlugin,
  getPluginUpdate,
  installablePlugins,
  installedVersionFromUrl,
  isPluginInstalled,
  resolvePlugin,
} from './pluginStore.ts'
export {
  type PhaseFailure,
  type ProgressReporter,
  type RpcStatus,
  type StatusCallback,
  type StatusPhase,
  type StatusStream,
  type StatusWindow,
  type StatusWithProgress,
  createProgressReporter,
  createStatusFanOut,
  createStatusWindow,
  downloadStatus,
  progressLabel,
  statusFraction,
  statusMessageText,
  statusProgressLabel,
  statusReading,
  statusSource,
  throttleStatusEmits,
  updateStatus,
  withProgress,
} from './progress.ts'
export {
  calculateRedispatchRange,
  doesIntersect2,
  intersection2,
} from './range.ts'
export { dedupe } from './dedupe.ts'
export {
  MAX_GLOB_REGIONS,
  matchRefNames,
  parseRegionNames,
  resolveNamedRegions,
  selectNamedRegions,
} from './selectNamedRegions.ts'
export type { RefNameMatchSource } from './selectNamedRegions.ts'
export { isValidTag, tagRegex } from './tags.ts'
export { formatRelativeTime } from './formatRelativeTime.ts'
export { fetchJson } from './fetchJson.ts'
export {
  type EncodedSessionParam,
  type SessionShareMode,
  ENCODED_PREFIX,
  JSON_PREFIX,
  SHARE_PREFIX,
  b64PadSuffix,
  encodeSessionParam,
  fromUrlSafeB64,
  readSessionFromDynamo,
  shareEndpoint,
  toUrlSafeB64,
} from './sessionSharing.ts'
export { coarseStripHTML } from './coarseStripHTML.ts'
export { measureText, measuredFont } from './measureText.ts'
export type { MeasuredFont } from './measureText.ts'
export { createScrollLatch } from './scrollLatch.ts'
export {
  MAX_ZOOM_RATE_PER_MS,
  SCROLL_ZOOM_FACTOR_DIVISOR,
  ZOOM_ACTIVE_WINDOW_MS,
  accumulateScroll,
  applyZoomAccum,
  getZoomNormalizer,
  isActivelyZooming,
  normalizeWheelDelta,
  wheelFrameElapsedMs,
  wheelZoomAccum,
} from './wheelZoom.ts'
export {
  avg,
  clamp,
  getDisplayStr,
  getNumberGrouping,
  max,
  maxFinite,
  min,
  minmax,
  polarToCartesian,
  radToDeg,
  reducePrecision,
  setNumberGrouping,
  sum,
  toLocale,
} from './numericUtils.ts'
export {
  type MinimalRegion,
  bpSpanPx,
  bpToPx,
  bytesForRegions,
  featureSpanPx,
  getBpDisplayStr,
  getTickDisplayStr,
  parseBpString,
} from './bpUtils.ts'
export {
  type BasicFeature,
  gatherOverlaps,
  mergeIntervals,
} from './intervals.ts'
export { clampToContig } from './clampToContig.ts'
export { springAnimate } from './springAnimate.ts'
export {
  localStorageAvailable,
  localStorageGetBoolean,
  localStorageGetItem,
  localStorageGetJSON,
  localStorageGetNumber,
  localStorageGetStringArray,
  localStorageRemoveItem,
  localStorageSetBoolean,
  localStorageSetItem,
  localStorageSetJSON,
  localStorageSetNumber,
  notifyLocalStorageKey,
  subscribeToLocalStorageKey,
} from './localStorage.ts'
export { renameRegionIfNeeded, renameRegionsIfNeeded } from './renameRegions.ts'
export { addAndShowTrack } from './addAndShowTrack.ts'
export {
  addTrackFromWidget,
  containerDisplaysAssembly,
  finishAddTrack,
  type AddTrackWidgetSelf,
  type AddTrackWorkflowModel,
} from './addTrackFromWidget.ts'
export { namesTemporaryAssembly } from './temporaryAssembly.ts'
export { makeTrackId } from './makeTrackId.ts'
export { matchTrackId } from './matchTrackId.ts'

export { drawImageOntoCanvasContext } from './offscreenCanvasPonyfill.ts'
export { indexedDBAvailable, isElectron, isNode, rIC } from './environment.ts'
export { isWebWorker } from './isWebWorker.ts'
export {
  sessionStorageAvailable,
  sessionStorageGetItem,
  sessionStorageRemoveItem,
  sessionStorageSetItem,
} from './sessionStorage.ts'
export { isObject } from './objectUtils.ts'
export { openPromotableDisplays } from './openDisplays.ts'
export {
  type ReorderDirection,
  applyOrderWithin,
  reorder,
  reorderWithin,
} from './reorder.ts'
export { getStr } from './getStr.ts'
export { downloadPhase, getLocationUri, resolveUri } from './getLocationUri.ts'
export { measureGridWidth, resolveSelectedIds } from './dataGridUtils.ts'
export { isRpcResult } from './rpc.ts'
export {
  aesDecrypt,
  aesEncrypt,
  sha256,
  sha256Base64,
  sha256Base64Url,
  toBase64,
  toBase64Url,
} from './crypto.ts'
export {
  type FeatureWidgetTypeRef,
  notifyFeatureDetailsMiss,
  openFeatureWidget,
} from './openFeatureWidget.ts'
export { withFeatureDetails } from './withFeatureDetails.ts'
export {
  canonicalizeViewRefName,
  findParentThat,
  findParentThatIs,
  getContainingDisplay,
  getContainingTrack,
  getContainingView,
  getEnv,
  getSession,
  hashCode,
  objectHash,
} from './mstUtils.ts'

// this is recommended in a later comment in
// https://github.com/electron/electron/issues/2288 for detecting electron in a
// renderer process, which is the one that has node enabled for us
//
/**
 * Convert a browser File (from a drop zone or file input) into a FileLocation:
 * a native local path under electron, or an in-memory blob location otherwise.
 */
export function fileToLocation(file: File): FileLocation {
  if (isElectron) {
    return {
      // @ts-ignore - electron injects require onto window, needs to be ignore not expect-error for now
      localPath: window.require('electron').webUtils.getPathForFile(file),
      locationType: 'LocalPathLocation',
    }
  } else {
    const loc = storeBlobLocation({ blob: file })
    if ('blobId' in loc) {
      return loc
    } else {
      throw new Error('could not store file as a blob location')
    }
  }
}

export {
  type Frame,
  complement,
  complementTable,
  defaultStarts,
  getFrame,
  revcom,
  reverse,
  stitch,
} from './seqUtils.ts'
export { revlist } from './revlist.ts'
// Part of the published ABI at v4.0.0 and v4.3.0 and dropped by a barrel
// split, which is the same way `defaultCodonTable` went (ac47890743). Nothing in
// this repo imports them from here, but the barrel is what external plugins
// resolve against at runtime: jbrowse-plugin-msaview and jbrowse-plugin-mafviewer
// both `import { useLocalStorage } from '@jbrowse/core/util'`, and on a host
// without it that is `(0, PR.useLocalStorage) is not a function` when the panel
// renders. The implementations never went anywhere -- only these lines did.
export {
  useCreateOnce,
  useDebounce,
  useFinalUnmount,
  useLocalStorage,
  useWidthSetter,
} from './hooks.ts'
export { renderToStaticMarkup } from './renderToStaticMarkup.ts'
export {
  codonTable,
  defaultCodonTable,
  generateCodonTable,
} from './geneticCodes.ts'
export {
  IUPAC_MOTIF_REGEX,
  isPalindromic,
  iupacToRegex,
  reverseComplementIupac,
} from './iupac.ts'
export {
  type MotifListParse,
  type MotifParseError,
  type ParsedMotif,
  parseMotifList,
} from './parseMotifList.ts'

// Browser-safe mirror of `indexableAdapters` in @jbrowse/text-indexing-core,
// which cannot be imported here (it pulls in node:fs). Pinned by the parity
// test in packages/text-indexing/src/util.test.ts — the one place that depends
// on both packages. NOT text-indexing-core's own common.test.ts, which this
// used to name: that one calls text-indexing-core's `isSupportedIndexingAdapter`
// rather than this mirror, so it passes however far the two drift apart.
export function isSupportedIndexingAdapter(type = '') {
  return [
    'Gff3Adapter',
    'Gff3TabixAdapter',
    'GtfAdapter',
    'GtfTabixAdapter',
    'VcfAdapter',
    'VcfTabixAdapter',
  ].includes(type)
}

// Null prototype, not `{}`: keys are data (a BAM QNAME, a track category), and
// on a plain object `result['constructor'] ??= []` finds Object and never
// assigns, so the next line throws.
//
// Still an object rather than a Map because this is on the plugin ABI — a Map
// would leave `Object.entries` on a published plugin returning [] and silently
// doing nothing. So integer-like keys still hoist ahead of the rest; anything
// needing insertion order builds its own Map (see tree-sidebar's CLAUDE.md).
export function groupBy<T>(array: Iterable<T>, predicate: (v: T) => string) {
  const result: Record<string, T[]> = Object.create(null)
  for (const value of array) {
    const t = predicate(value)
    result[t] ??= []
    result[t].push(value)
  }
  return result
}

export function notEmpty<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

export function testAdapter(
  fileName: string,
  regex: RegExp,
  adapterHint: string | undefined,
  expected: string,
) {
  return (regex.test(fileName) && !adapterHint) || adapterHint === expected
}

export {
  type Feature,
  type SimpleFeatureSerialized,
  type SimpleFeatureSerializedNoId,
  default as SimpleFeature,
  isFeature,
} from './simpleFeature.ts'

export { saveAs } from './FileSaver/index.ts'
export {
  type SaveSvgAsImageOptions,
  saveSvgAsImage,
  svgHtmlToPngBlob,
} from '../svg/saveSvgAsImage.ts'
export {
  type ActiveFetch,
  type StatusChannel,
  type StatusReporter,
  createStatusChannel,
  createStopTokenRotation,
} from './createStopTokenRotation.ts'
export { createSharedSetup } from './createSharedSetup.ts'
export { isDataCurrent } from './isDataCurrent.ts'
export {
  handleFetchError,
  isAbortException,
  makeAbortError,
} from './aborting.ts'
export { linkify } from './linkify.ts'
export { locStringsToRegions } from './locStringsToRegions.ts'
export type { RefNameSource } from './locStringsToRegions.ts'
export {
  type ParsedLocString,
  UnknownRefNameError,
  assembleLocString,
  assembleLocStringRaw,
  assembleLocStrings,
  compareLocStrings,
  compareLocs,
  parseLocString,
  parseLocStringOneBased,
  stringify,
} from './locString.ts'
export {
  type LastStopTokenCheck,
  type StopToken,
  type StopTokenChecker,
  type StopTokenSignal,
  checkStopToken,
  checkStopTokenThrottled,
  createStopToken,
  createStopTokenChecker,
  hasSharedArrayBuffer,
  isStopToken,
  isStopped,
  markStopTokenStopped,
  registerStopTokenBroadcaster,
  stopStopToken,
  stopTokenSignal,
  withStopTokenCheck,
  withStopTokenSignal,
} from './stopToken.ts'
export {
  type AddTrackComponentModel,
  type AddTrackComponentProps,
  adapterNeedsAddTrackComponent,
  addAddTrackComponent,
} from './addTrackComponent.ts'
export { adapterConfigFromSpec } from './formatGuessers.ts'
export {
  type AdapterConfig,
  type AdapterGuesser,
  type LooseTrackInput,
  type TrackTypeGuesser,
  UNKNOWN,
  UNSUPPORTED,
  addAdapterGuesser,
  addTrackTypeGuesser,
  clearFileFromCache,
  ensureFileHandleReady,
  findFileHandleIds,
  generateUnknownTrackConf,
  generateUnsupportedTrackConf,
  getBlob,
  getBlobMap,
  getConfAssemblyNames,
  getFileFromCache,
  getFileName,
  getRpcSessionId,
  getTrackAssemblyNames,
  getTrackName,
  guessAdapter,
  guessTrackConf,
  guessTrackType,
  hasFileHandlesInCache,
  hideTrackGeneric,
  makeIndex,
  makeIndexType,
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
} from './tracks.ts'
export {
  getFileHandle,
  isFileSystemAccessSupported,
  storeFileHandle,
  verifyPermission,
} from './fileHandleStore.ts'
export { IntervalTree } from './IntervalTree.ts'
export { cmpStr } from './cmpStr.ts'
export {
  diffTrackConfig,
  flattenTrackConfigDelta,
  mergeTrackConfig,
} from './trackConfigDelta.ts'
export type { TrackConfigChange } from './trackConfigDelta.ts'
export {
  BEZIER_CONNECTOR_MAX_REACH_PX,
  bezierConnectorPath,
} from './bezierConnector.ts'
export {
  type AlignmentData,
  type DiagonalizationResult,
  diagonalizeRegions,
} from './diagonalizeRegions.ts'
