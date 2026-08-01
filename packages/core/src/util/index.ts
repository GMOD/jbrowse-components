import { isElectron } from './environment.ts'
import { toLocale } from './numericUtils.ts'
import { shorten } from './stringUtils.ts'
import { storeBlobLocation } from './tracks.ts'

import type { FileLocation } from './types/index.ts'

// `unzip` is deliberately NOT re-exported here — it lives at
// '@jbrowse/core/util/unzip' so this barrel does not reach bgzf/pako. See that
// file for why a re-export of it cannot be tree-shaken.

export { shorten, shorten2, truncateMiddle } from './stringUtils.ts'
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
  type SessionWithAddTracks,
  type SessionWithConfigEditing,
  type SessionWithConnectionEditing,
  type SessionWithConnections,
  type SessionWithDeleteTrackConf,
  type SessionWithDrawerWidgets,
  type SessionWithFocusedViewAndDrawerWidgets,
  type SessionWithSessionPlugins,
  type SessionWithShareURL,
  type SessionWithWidgets,
  type SnackAction,
  type TrackActionView,
  type TrackContainer,
  type TrackViewModel,
  type TypeTestedByPredicate,
  type UriLocation,
  type Widget,
  type WidgetMap,
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
  isSessionWithAddTracks,
  isSessionWithDeleteTrackConf,
  isSessionWithSessionPlugins,
  isSessionWithShareURL,
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
  installedVersionFromUrl,
  resolvePlugin,
} from './pluginStore.ts'
export {
  type ProgressReporter,
  type RpcStatus,
  type StatusCallback,
  type StatusWithProgress,
  aggregateStatus,
  createProgressReporter,
  createStatusFanOut,
  createStatusThrottle,
  downloadStatus,
  progressLabel,
  statusFraction,
  statusMessageText,
  statusProgressLabel,
  updateStatus,
  withProgress,
} from './progress.ts'
export { when } from './when.ts'
export {
  calculateRedispatchRange,
  doesIntersect2,
  intersection2,
} from './range.ts'
export { dedupe } from './dedupe.ts'
export { selectNamedRegions } from './selectNamedRegions.ts'
export { isValidTag, tagRegex } from './tags.ts'
export { formatRelativeTime } from './formatRelativeTime.ts'
export { fetchJson } from './fetchJson.ts'
export {
  type EncodedSessionParam,
  type SessionShareMode,
  b64PadSuffix,
  encodeSessionParam,
  fromUrlSafeB64,
  readSessionFromDynamo,
  toUrlSafeB64,
} from './sessionSharing.ts'
export { coarseStripHTML } from './coarseStripHTML.ts'
export { measureText } from './measureText.ts'
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
} from './bpUtils.ts'
export {
  type BasicFeature,
  gatherOverlaps,
  mergeIntervals,
} from './intervals.ts'
export { springAnimate } from './springAnimate.ts'
export {
  localStorageGetBoolean,
  localStorageGetItem,
  localStorageGetJSON,
  localStorageGetNumber,
  localStorageSetBoolean,
  localStorageSetItem,
  localStorageSetJSON,
  localStorageSetNumber,
} from './localStorage.ts'
export { renameRegionIfNeeded, renameRegionsIfNeeded } from './renameRegions.ts'
export { addAndShowTrack } from './addAndShowTrack.ts'
export { makeTrackId } from './makeTrackId.ts'
export { matchTrackId } from './matchTrackId.ts'

export { drawImageOntoCanvasContext } from './offscreenCanvasPonyfill.ts'
export { isElectron, isNode, rIC } from './environment.ts'
export { isObject } from './objectUtils.ts'
export { getStr } from './getStr.ts'
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
  openFeatureWidget,
} from './openFeatureWidget.ts'
export {
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

export function stringify(
  {
    refName,
    coord,
    assemblyName,
    oob,
  }: {
    assemblyName?: string
    coord: number
    refName?: string
    oob?: boolean
  },
  useAssemblyName?: boolean,
) {
  return [
    assemblyName && useAssemblyName ? `{${assemblyName}}` : '',
    refName
      ? `${shorten(refName)}:${toLocale(coord)}${oob ? ' (out of bounds)' : ''}`
      : '',
  ].join('')
}

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
export { codonTable, generateCodonTable } from './geneticCodes.ts'
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
// test in packages/text-indexing-core/src/types/common.test.ts
export function isSupportedIndexingAdapter(type = '') {
  return [
    'Gff3Adapter',
    'Gff3TabixAdapter',
    'GtfAdapter',
    'VcfAdapter',
    'VcfTabixAdapter',
  ].includes(type)
}

// Regular-plural noun for a count, for the "N hidden features" / "Clear N
// highlights" family of labels. Takes the count rather than returning a bare
// suffix so the call site reads as the sentence it produces, and so `0` pairs
// with the plural ("0 features") the way English does — the hand-written
// `n > 1 ? 's' : ''` scattered around got that right only because every one of
// those labels was already gated on n > 0.
export function pluralize(count: number, noun: string) {
  return count === 1 ? noun : `${noun}s`
}

// Sentence-case a noun that arrives lowercase because it also appears
// mid-sentence — the display nouns ('feature', 'read', 'variant') that name
// what a track holds are the case this exists for.
export function capitalizeFirst(s: string) {
  return `${s.charAt(0).toUpperCase()}${s.slice(1)}`
}

export function groupBy<T>(array: Iterable<T>, predicate: (v: T) => string) {
  const result: Record<string, T[]> = {}
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

export type ReorderDirection = 'up' | 'down' | 'top' | 'bottom'

/**
 * Move the element at `idx` within `arr` in the given direction, returning a new
 * array. An edge move (already at top/bottom) returns an unchanged copy.
 */
export function reorder<T>(
  arr: readonly T[],
  idx: number,
  direction: ReorderDirection,
): T[] {
  const next = [...arr]
  if (idx >= 0 && idx < arr.length) {
    const [item] = next.splice(idx, 1)
    const target =
      direction === 'up'
        ? Math.max(0, idx - 1)
        : direction === 'down'
          ? Math.min(arr.length - 1, idx + 1)
          : direction === 'top'
            ? 0
            : arr.length - 1
    next.splice(target, 0, item!)
  }
  return next
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
  createStopTokenRotation,
} from './createStopTokenRotation.ts'
export { createSharedSetup } from './createSharedSetup.ts'
export { isDataCurrent } from './isDataCurrent.ts'
export { isAbortException, makeAbortError } from './aborting.ts'
export { linkify } from './linkify.ts'
export {
  type ParsedLocString,
  UnknownRefNameError,
  assembleLocString,
  assembleLocStringRaw,
  compareLocStrings,
  compareLocs,
  parseLocString,
  parseLocStringOneBased,
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
  withStopTokenSignal,
} from './stopToken.ts'
export {
  type AddTrackComponentModel,
  type AddTrackComponentProps,
  addAddTrackComponent,
} from './addTrackComponent.ts'
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
