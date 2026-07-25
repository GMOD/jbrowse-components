export {
  adapterLocationKey,
  createReadlineInterface,
  decodeURIComponentNoThrow,
  defaultAttributesToIndex,
  defaultFeatureTypesToExclude,
  generateMeta,
  getLocalOrRemoteStream,
  guessAdapterFromFileName,
  indexFiles,
  indexGff3,
  indexVcf,
  isURL,
  makeLocation,
  parseAttributes,
  sanitizeForFilename,
} from '@jbrowse/text-indexing-core'
export type {
  Gff3Adapter,
  Gff3IndexerOptions,
  Gff3TabixAdapter,
  GtfAdapter,
  IndexerOptions,
  LocalPathLocation,
  Track,
  TrackIndexProgress,
  UriLocation,
  VcfAdapter,
  VcfTabixAdapter,
} from '@jbrowse/text-indexing-core'
export { createTextSearchConf, findTrackConfigsToIndex } from './util.ts'
export type {
  Assembly,
  BgzipFastaAdapter,
  ChromeSizesAdapter,
  Config,
  CustomRefNameAliasAdapter,
  CustomSequenceAdapter,
  IndexedFastaAdapter,
  RefNameAliasAdapter,
  Sequence,
  TextSearching,
  TrixTextSearchAdapter,
  TwoBitAdapter,
  indexType,
} from './util.ts'

export { indexTracks } from './TextIndexing.ts'
