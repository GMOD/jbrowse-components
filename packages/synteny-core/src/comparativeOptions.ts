import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'

// #region comparativeOptions
export interface ComparativeOptions extends BaseOptions {
  // The assembly on the *other* side of a synteny band, set by the synteny
  // render RPC from the target view. Lets a multi-genome adapter (e.g.
  // MultiGenomePAFAdapter) whose config lists all N assemblies isolate the exact
  // pair a band draws — `assemblyName` alone can't, since one file backs every
  // pair. Pairwise adapters (which already know their pair) ignore it.
  targetAssemblyName?: string
  // This side of the band, when it is not the region's assembly: a region on
  // the anchor of a source that holds every lane inside the anchor's window (a
  // pangenome graph, indexed on its reference alone) asks for this lane and
  // `targetAssemblyName` aligned to each other, read inside that window. The
  // records are on this lane's coordinates. An adapter declares that it
  // answers these with the `lanePairsOnAnchor` capability.
  queryAssemblyName?: string
  // A multi-genome adapter answering a no-target query folds the pairs
  // anchored on one query feature into one feature carrying `mates: [...]`,
  // each mate with its own pairwise `orientation`. Absent, one `mate`-carrying
  // feature per pair.
  mateShape?: 'grouped'
  // Each alignment record comes back cut to the region that fetched it, on both
  // axes, with its alignment string dropped: a liftOver chain spans tens of Mb,
  // and a display fitting a lane to whole records saw 80x the window. Honoured
  // by `ComparativeAdapterBase.getFeaturesInMultipleRegions`, for records that
  // ARE alignments — a gene-pair table's rows are genes and stay whole.
  clipToRegion?: boolean
  // With `clipToRegion`, each clipped record is further cut at every insertion
  // or deletion of this many bp or more, into one record per gap-free run —
  // ids and `syntenyId` suffixed per run — so a display that draws a record as
  // one straight placement draws the runs the alignment actually has rather
  // than a ribbon across a 25 kb indel. Read off the alignment string the clip
  // walks anyway; a record with none is one run.
  splitAtGapBp?: number
  // With `clipToRegion`, each piece keeps its own stretch of the alignment as
  // packed ops in `alignmentOps`, for a display that draws the indels between
  // two lanes.
  keepAlignment?: boolean
}
// #endregion
