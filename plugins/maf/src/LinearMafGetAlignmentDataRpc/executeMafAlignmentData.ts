import { rpcResult } from '@jbrowse/core/util/librpc'

import { loadMafSamplesAdapter } from '../util/loadMafSamplesAdapter.ts'
import { subscribeToObservable } from '../util/observableUtils.ts'
import { buildMafCoverageRegion } from './buildMafCoverageRegion.ts'
import { collectMafTransferables } from './collectTransferables.ts'
import { MafWirePacker } from './mafWirePacker.ts'

import type { MafWireRegionData } from '../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type {
  AlignmentRecord,
  BaseMafRpcArgs,
  EmptyRecord,
  Sample,
} from '../types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'

export interface LinearMafGetAlignmentDataArgs extends BaseMafRpcArgs {
  // The display's subtree filter, as a SET. Rows outside it are neither emitted
  // nor counted in coverage/identity, so a filtered subtree ships (and scores)
  // only the genomes it draws. No order travels with it: rows name their
  // species and the client places them (see `placeMafRegionData`).
  subtreeFilter?: string[]
}

export interface LinearMafGetAlignmentDataResult {
  samples: Sample[]
  treeNewick: string | undefined
  /**
   * True when `samples` came from config or the guide tree: the same complete
   * set for every region, so the client replaces its row set with it. False on
   * a sample-discovery track, where `samples` is only the genomes this region's
   * blocks happened to contain and the client unions it into what it already
   * has (see `setSamples`).
   */
  samplesCanonical: boolean
  regionData: MafWireRegionData
}

/**
 * Which sample the block's reference sequence came from — the row whose own
 * alignment IS the reference, found by sequence identity.
 *
 * Structural on purpose. The obvious answer, `region.assemblyName`, is the
 * *view's* name for the reference and only coincidentally the MAF's: a
 * MAF-tabix track sets `refAssemblyName` on the adapter precisely when the two
 * differ, and a bigMaf/TAF file names its reference by whatever db name it was
 * built with. Where they differed the name matched no row, so nothing was
 * excluded from the conservation denominator and the reference's guaranteed
 * self-match inflated every position — an all-divergent column read `1/N`
 * instead of 0.
 *
 * Cheap despite comparing sequences: all three adapters set the feature's `seq`
 * to the reference row's own `seq` (see `selectReferenceSequenceString`, the
 * first `s` line, and TAF's `row0`), so the first candidate is the same string
 * *object* and the comparison is a pointer check. Insertion order into
 * `alignments` is stanza order, reference first, so a second species that
 * happens to be byte-identical across the block cannot win.
 *
 * Undefined when no row matches — a malformed stanza with no resolvable
 * reference — leaving the caller its `region.assemblyName` fallback.
 */
export function referenceSampleId(
  alignments: Record<string, AlignmentRecord>,
  refSeq: string,
) {
  if (refSeq) {
    for (const sampleId in alignments) {
      if (alignments[sampleId]!.seq === refSeq) {
        return sampleId
      }
    }
  }
  return undefined
}

/**
 * Fetch MAF alignment features for a single region. Returns raw
 * `MafWireRegionData`: one byte arena holding every block's reference and every
 * row's aligned sequence, plus parallel typed-array columns naming the species
 * each row belongs to rather than the screen row it lands on (placement is the
 * client's — see `mafRenderingBackendTypes.ts`). The GPU instance buffer is
 * built on the main thread (in `startRenderingBackend`'s per-region encode)
 * from this raw data plus the current `gpuProps()` — that way color/style
 * toggles never round-trip through the RPC.
 *
 * Nothing per-row is ever allocated as an object here. The packer is fed
 * streaming and its columns go out on the transfer list as a fixed handful of
 * buffers, which is what makes a wide region's reply cost microseconds instead
 * of seconds — see `collectMafTransferables` for the measurement.
 */
export async function executeMafAlignmentData({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: LinearMafGetAlignmentDataArgs
}) {
  const { regions, adapterConfig, sessionId, subtreeFilter } = args
  const region = regions[0]!
  const {
    adapter,
    samples: configSamples,
    treeNewick,
  } = await loadMafSamplesAdapter(pluginManager, sessionId, adapterConfig)
  const hasConfiguredSamples = configSamples.length > 0

  // Samples come from config or the guide tree (see getSamples). With a set,
  // the adapter resolves tokens against it. With neither, the adapter discovers
  // the genomes from the alignment data, so the track still renders without a
  // hand-listed sample list.
  const opts = hasConfiguredSamples ? { ...args, samples: configSamples } : args

  // Pass 1: buffer blocks + collect sample order. Nothing is encoded yet — the
  // subtree filter decides which rows reach the arena, and the arena is sized
  // from the surviving rows in pass 2.
  const rawBlocks: {
    startBp: number
    refSeq: string
    alignments: Record<string, AlignmentRecord>
    empties: Record<string, EmptyRecord>
  }[] = []
  // The sample id of the row the block's reference sequence came from, resolved
  // from the first block that names one (all blocks of a track share a
  // reference species). See `referenceSampleId`.
  let refSampleId: string | undefined
  const discoveredOrder = new Map<string, number>()
  const discover = (sampleId: string) => {
    if (!discoveredOrder.has(sampleId)) {
      discoveredOrder.set(sampleId, discoveredOrder.size)
    }
  }
  await subscribeToObservable(
    adapter.getFeatures(region, opts),
    (feature: Feature) => {
      const alignments = feature.get('alignments') as Record<
        string,
        AlignmentRecord
      >
      const empties = feature.get('empties') as Record<string, EmptyRecord>
      const refSeq = feature.get('seq') as string
      refSampleId ??= referenceSampleId(alignments, refSeq)
      for (const sampleId in alignments) {
        discover(sampleId)
      }
      // A species present only on `e` lines (bridged in every fetched block)
      // still needs a row so its bridge line renders.
      for (const sampleId in empties) {
        discover(sampleId)
      }
      rawBlocks.push({
        startBp: feature.get('start'),
        refSeq,
        alignments,
        empties,
      })
    },
  )

  const samples: Sample[] = hasConfiguredSamples
    ? configSamples
    : [...discoveredOrder.keys()].map(id => ({ id, label: id }))
  // Rows outside the active subtree are dropped here rather than shipped and
  // hidden. The returned `samples` stays the full set so the sidebar tree +
  // "clear filter" still see every genome.
  const visible = subtreeFilter?.length ? new Set(subtreeFilter) : undefined
  const isVisible = (sampleId: string) => !visible || visible.has(sampleId)

  // Pass 2: size the pack. Every count here is exact, so the packer allocates
  // each column and the arena once — the arena is the largest thing the worker
  // holds, and letting it double its way up would memcpy tens of megabytes
  // several times over. Only string lengths and record keys are touched; no
  // sequence bytes move until pass 3.
  const reserve = { blocks: rawBlocks.length, rows: 0, empties: 0, bytes: 0 }
  for (const { refSeq, alignments, empties } of rawBlocks) {
    reserve.bytes += refSeq.length
    for (const sampleId in alignments) {
      if (isVisible(sampleId)) {
        reserve.rows++
        reserve.bytes += alignments[sampleId]!.seq.length
      }
    }
    for (const sampleId in empties) {
      if (isVisible(sampleId)) {
        reserve.empties++
      }
    }
  }

  // Pass 3: pack. One MAF feature = one alignment block; a single fetched
  // region can contain many disjoint blocks at unrelated genomic anchors.
  // for...in + push avoids the Object.entries+flatMap temp array allocations on
  // a per-block hot path.
  const packer = new MafWirePacker(reserve)
  for (const { startBp, refSeq, alignments, empties } of rawBlocks) {
    packer.startBlock(startBp, refSeq)
    for (const sampleId in alignments) {
      if (isVisible(sampleId)) {
        const a = alignments[sampleId]!
        packer.addRow({
          sampleId,
          seq: a.seq,
          chr: a.chr,
          start: a.start,
          strand: a.strand ?? 1,
          srcSize: a.srcSize,
          context: a.context,
        })
      }
    }
    for (const sampleId in empties) {
      if (isVisible(sampleId)) {
        packer.addEmpty(sampleId, empties[sampleId]!)
      }
    }
  }
  const packed = packer.finishBlocks()

  // `packed` already contains exactly the visible rows (narrowed by the subtree
  // filter above), so coverage over them is automatically scoped to the visible
  // subtree — no separate row filtering needed.
  //
  // The reference is normally listed as a sample, so it self-matches at every
  // column; `referenceSampleId` names its row so the conservation metric can
  // exclude it. `region.assemblyName` is the fallback for a file whose blocks
  // resolved no reference at all; identity runs over every row when neither
  // names one.
  const refRowId = refSampleId ?? region.assemblyName
  const coverage = buildMafCoverageRegion(
    packed,
    region.start,
    region.end,
    isVisible(refRowId) ? refRowId : undefined,
  )

  // rpcResult wraps value + transfer list; the RPC framework unwraps it before
  // returning to the caller, whose type is the RpcRegistry
  // `LinearMafGetAlignmentData.return` declaration. Hence no return annotation
  // on this function and no cast here.
  // #region zeroCopy
  const regionData: MafWireRegionData = { ...packed, coverage, refSampleId }
  const result: LinearMafGetAlignmentDataResult = {
    samples,
    treeNewick,
    samplesCanonical: hasConfiguredSamples,
    regionData,
  }
  // second arg is the transfer list: these buffers are moved to the main
  // thread, not structured-cloned. collectMafTransferables walks the result and
  // gathers every ArrayBuffer in it — a fixed handful, because the wire is
  // columnar; see that function for why the length of this list is what the
  // whole shape is designed around.
  return rpcResult(result, collectMafTransferables(regionData))
  // #endregion
}
