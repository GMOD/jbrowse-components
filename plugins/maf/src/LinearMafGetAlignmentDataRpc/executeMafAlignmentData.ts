import { measureRegionBytes } from '@jbrowse/core/rpc/byteBudget'
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
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
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
  /**
   * What the alignment index quoted for this region, when the fetch carried a
   * `byteLimit`. Carried back on the success path too, so the display's gate
   * re-anchors its stored estimate on every fetch rather than only on the ones
   * it refuses.
   */
  bytes?: number
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
  args: RpcExecuteArgs<'LinearMafGetAlignmentData'>
}) {
  const {
    regions,
    adapterConfig,
    sessionId,
    subtreeFilter,
    byteLimit,
    stopToken,
    statusCallback,
  } = args
  const region = regions[0]!
  const {
    adapter,
    samples: configSamples,
    treeNewick,
  } = await loadMafSamplesAdapter(pluginManager, sessionId, adapterConfig)
  const hasConfiguredSamples = configSamples.length > 0

  // The gate, on the file this tier reads: the MAF adapter's own index, which
  // is what `byteGateAdapterPath` names while the display is on the detail
  // tier. A 470-way alignment is megabytes inside a 40kb window, so this is the
  // one measurement standing between a zoomed-out view and every species' bases.
  const { bytes, tooLarge } = await measureRegionBytes({
    dataAdapter: adapter,
    region,
    byteLimit,
    stopToken,
    statusCallback,
  })
  if (tooLarge) {
    return tooLarge
  }

  // Samples come from config or the guide tree (see getSamples). With a set,
  // the adapter resolves tokens against it. With neither, the adapter discovers
  // the genomes from the alignment data, so the track still renders without a
  // hand-listed sample list.
  const opts = hasConfiguredSamples ? { ...args, samples: configSamples } : args

  // Rows outside the active subtree are dropped rather than shipped and hidden.
  // The returned `samples` stays the full set so the sidebar tree + "clear
  // filter" still see every genome. Resolved before the fetch because the pack
  // below runs inside it.
  const visible = subtreeFilter?.length ? new Set(subtreeFilter) : undefined
  const isVisible = (sampleId: string) => !visible || visible.has(sampleId)

  // One MAF feature = one alignment block, packed as it arrives; a single
  // fetched region can contain many disjoint blocks at unrelated genomic
  // anchors. for...in avoids the Object.entries+flatMap temp arrays on a
  // per-block hot path.
  //
  // **The packer is given no `reserve`, so its arena and columns grow by
  // doubling, and that is the deliberate trade.** Sizing them exactly needs
  // every block counted before any is encoded, which means holding the whole
  // region's records — and that intermediate, not the memcpy, is what dominates
  // the shape real files have. Buffering to size the arena measured
  // **1.18x slower** and **491 MB against 263 MB** of peak RSS on 20000 blocks
  // of 8 columns; on 1600 blocks of 250 columns the two are within 3% and the
  // buffered version is nominally ahead. Real MAFs are the first shape — ce11's
  // 26-way has a 7bp median block — and that stage is 83% of the worker there,
  // so this is ~13% of the whole fetch. The bench is
  // `mafTabixBytes.bench.ts`, which lived in `92bea4941d` and needed a checkout
  // of a since-closed tabix PR to run; agent-docs reference/
  // MAF_WORKER_PIPELINE.md has the table it produced and the profile behind it.
  //
  // Growth costs a transient copy at each doubling — the last one holds the old
  // arena beside the new — which is bounded at ~1.5x the final arena, against
  // the region's worth of `seq` strings and records the buffer held for its
  // whole life.
  const packer = new MafWirePacker()
  // The sample id of the row the block's reference sequence came from, resolved
  // from the first block that names one (all blocks of a track share a
  // reference species). See `referenceSampleId`.
  let refSampleId: string | undefined
  // Discovery order cannot be read off the packer's own sample dictionary: that
  // one sees visible rows only, and a filtered subtree still has to return every
  // genome for the sidebar tree.
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
      packer.startBlock(feature.get('start'), refSeq)
      for (const sampleId in alignments) {
        discover(sampleId)
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
      // A species present only on `e` lines (bridged in every fetched block)
      // still needs a row so its bridge line renders.
      for (const sampleId in empties) {
        discover(sampleId)
        if (isVisible(sampleId)) {
          packer.addEmpty(sampleId, empties[sampleId]!)
        }
      }
    },
  )

  const samples: Sample[] = hasConfiguredSamples
    ? configSamples
    : [...discoveredOrder.keys()].map(id => ({ id, label: id }))

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
    bytes,
  }
  // second arg is the transfer list: these buffers are moved to the main
  // thread, not structured-cloned. collectMafTransferables walks the result and
  // gathers every ArrayBuffer in it — a fixed handful, because the wire is
  // columnar; see that function for why the length of this list is what the
  // whole shape is designed around.
  return rpcResult(result, collectMafTransferables(regionData))
  // #endregion
}
