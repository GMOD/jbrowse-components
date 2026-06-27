import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region, StatusCallback } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { Observable } from 'rxjs'

/**
 * Shared types for MAF alignment data
 */

/**
 * Fields every MAF RPC method shares. `regions` is always a single-element
 * array (never a bare `region`) so the `RpcMethodTypeWithRenameRegions` base
 * class maps the refName into the adapter's naming scheme — see
 * `renameRegionsIfNeeded`. A bare region would silently skip that rename and
 * fetch nothing when the assembly and adapter disagree on chromosome names
 * (e.g. `5` vs `chr5`).
 */
export interface BaseMafRpcArgs {
  adapterConfig: AnyConfigurationModel
  sessionId: string
  regions: Region[]
  stopToken?: StopToken
  statusCallback?: StatusCallback
}

/**
 * Options for MAF adapter getFeatures call.
 * Extends BaseOptions with optional samples filter for subtree optimization.
 */
export interface MafAdapterOptions extends BaseOptions {
  /** If provided, only parse alignments for these sample IDs */
  samples?: Sample[]
}

/**
 * Sample set + guide tree every MAF adapter ships alongside features (so a track
 * needs no separate setup RPC). `treeNewick` is undefined when there's no tree.
 */
export interface MafSamplesResult {
  samples: Sample[]
  treeNewick: string | undefined
}

/**
 * Adapter contract the MAF RPC methods rely on: features plus `getSamples`.
 * `getSummaryFeatures` is optional — only BigMafAdapter ships a summary
 * sub-adapter; the tabix/TAF adapters omit it (the summary RPC then returns no
 * rows and the display falls back to the byte-estimate force-load gate).
 */
export type MafSamplesAdapter = BaseFeatureDataAdapter & {
  getSamples: () => Promise<MafSamplesResult>
  getSummaryFeatures?: (
    region: Region,
    opts?: { stopToken?: StopToken },
  ) => Observable<MafSummaryRecord>
}

/**
 * MAF context/empty status characters (UCSC spec). Used on `i` lines (left/
 * right context of an aligned row) and `e` lines (status of a bridged/empty
 * row): C contiguous, I non-aligning bases between, N new chrom/scaffold, n
 * new chrom/scaffold but bridged, M missing data (Ns), T tandem duplication.
 */
export type MafStatus = 'C' | 'I' | 'N' | 'n' | 'M' | 'T'

/**
 * Left/right context for an aligned row, parsed from a MAF `i` line. Describes
 * the relationship between this block's sequence and the species' sequence in
 * the adjacent blocks. Surfaced in hover tooltips, not rendered.
 */
export interface AlignmentContext {
  leftStatus?: MafStatus
  leftCount?: number
  rightStatus?: MafStatus
  rightCount?: number
}

/**
 * Represents a single organism's alignment within a MAF block.
 * Used by adapters to return alignment data and by rendering code.
 */
export interface AlignmentRecord {
  /** Chromosome/contig name */
  chr: string
  /** Start position in the organism's coordinate system */
  start: number
  /** The aligned sequence (including gaps as '-') */
  seq: string
  /** +1/-1; from the `s` line strand field (not all adapters supply it) */
  strand?: number
  /** Total source sequence length; from the `s` line srcSize field */
  srcSize?: number
  /** Left/right context from the following `i` line, when present */
  context?: AlignmentContext
}

/**
 * A species that has no aligning sequence in a block but whose flanking blocks
 * are bridged by a chain — a MAF `e` line. UCSC renders these as single/double
 * lines or a pale bar depending on `status`.
 */
export interface EmptyRecord {
  /** Chromosome/contig name */
  chr: string
  /** Start of the non-aligning region in the source sequence */
  start: number
  /** Size in bp of the non-aligning region */
  size: number
  /** +1/-1 */
  strand: number
  /** Total source sequence length */
  srcSize: number
  /** Relationship of this empty region to the flanking blocks */
  status: MafStatus
}

/**
 * One row of a UCSC bigMafSummary.bb (autoSql `mafSummary`): a single
 * alignment block for a single species, with no sequence — cheap to fetch at
 * zoom-out. `leftStatus`/`rightStatus` reuse the same C/I/N/n/M/T scheme as
 * e/i lines, and are `undefined` when the summary leaves them blank.
 */
export interface MafSummaryRecord {
  refName: string
  start: number
  end: number
  /** species / source db name, e.g. "panTro6" */
  src: string
  score: number
  leftStatus?: MafStatus
  rightStatus?: MafStatus
}

/**
 * Sample/organism metadata for display
 */
export interface Sample {
  id: string
  label: string
  color?: string
}
