import type {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { GatedFetchArgs } from '@jbrowse/core/rpc/byteBudget'
import type { Region, UriLocation } from '@jbrowse/core/util'
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
 *
 * Every tier takes the shared `byteLimit`, and each measures the file it is
 * about to read — the alignment index on the detail path, the `summaryAdapter`
 * sub-adapter on the summary one — so the number the banner quotes always
 * describes the download that was actually refused.
 */
export interface BaseMafRpcArgs extends GatedFetchArgs {
  adapterConfig: Record<string, unknown>
  regions: Region[]
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
 * `getSummaryFeatures` is optional in the type and implemented by all four MAF
 * adapters, each through the same `summaryAdapter` slot. It stays optional
 * because the slot itself is: an unconfigured track returns no rows and the
 * display falls back to the byte-estimate force-load gate.
 */
export type MafSamplesAdapter = BaseFeatureDataAdapter & {
  getSamples: () => Promise<MafSamplesResult>
  getSummaryFeatures?: (
    region: Region,
    opts?: BaseOptions,
  ) => Observable<MafSummaryRecord>
  /**
   * The `summaryAdapter` slot resolved, so the gate can measure the file the
   * summary tier is about to read.
   *
   * Required where `getSummaryFeatures` is optional, because it answers a
   * different question: not "does this track have a summary tier" — an
   * unconfigured slot resolves `undefined` — but "resolve the slot", which every
   * adapter can do. Optional, it would let an implementor of this contract drop
   * the byte gate rather than fail to compile, and a summary read at
   * whole-genome scale would then proceed unmeasured and silently.
   */
  summaryAdapter: () => Promise<BaseFeatureDataAdapter | undefined>
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
 * One row of a UCSC `mafFrames.bb` (autoSql `mafFrames`): a CDS reading-frame
 * assignment for a single species, projected onto the reference coordinates of
 * a MAF component. Lets the gene structure be drawn on every aligned species'
 * row (the species is keyed by `src`, exactly like `MafSummaryRecord`), coloring
 * each CDS segment by its reading `frame` (0/1/2 of the first base on `+`, last
 * base on `-`). `name` is the gene that defined the frame.
 */
export interface MafFrameRecord {
  refName: string
  start: number
  end: number
  /** species / source db name, e.g. "panTro6" */
  src: string
  /** codon position (0,1,2) of the first base (+) or last base (−) */
  frame: number
  /** +1/−1 */
  strand: number
  /** gene that defined the frame */
  name: string
  /**
   * Reference position of the connecting base in the next CDS exon, or -1.
   * `+`/`−` aware (next = higher coords on `+`, lower on `−`).
   *
   * How `enumerateCodons` stitches a codon across an exon boundary, and the
   * only one of `mafFrames`' four linkage columns it needs. The *trailing*
   * partial codon at an exon's edge is completed from here; the *leading*
   * partial is dropped, because the previous exon's own trailing stitch is the
   * same codon and emitting it from both sides would double it. So
   * `prevFramePos` — which the autoSql also carries, and which this type used
   * to declare and the RPC to ship — has no reader, and neither do
   * `isExonStart`/`isExonEnd`: `frame` already gives the codon position of the
   * record's first base, which is what the leading skip is computed from.
   *
   * The one thing the missing `prevFramePos` costs: an exon lying entirely
   * outside the fetched region emits no trailing stitch, so the boundary codon
   * at the region's left edge doesn't draw. The fetched region is the buffered
   * one — half a screen wider than the view on each side — so that codon is
   * essentially always off screen.
   */
  nextFramePos?: number
}

/**
 * Sample/organism metadata for display
 */
export interface Sample {
  id: string
  label: string
  color?: string
  /**
   * The assembly this sample's own genome is loaded as, making its rows
   * navigable ("open this species' locus in a new view"). Unset — the default —
   * means the row is not navigable.
   *
   * Deliberately supplied by the config rather than derived from `id`: sample
   * ids are UCSC db names in some alignments, scientific names in others (which
   * map to several assemblies, so a name lookup can silently land on the wrong
   * one), and lab-internal ids in others still. See
   * `agent-docs/reference/MAF_CROSS_VIEW_NAVIGATION.md`.
   */
  assemblyName?: string
  /**
   * Config to load `assemblyName` from when the session doesn't already have
   * it — a portal hosting many genomes keeps one config per genome, so the
   * aligned species is normally absent from the config the user opened. A
   * `UriLocation` rather than a bare url so `addRelativeUris` stamps its
   * `baseUri`, letting a hosted config point at a sibling config by relative
   * path.
   */
  assemblyConfigLocation?: UriLocation
}
