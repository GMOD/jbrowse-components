import { measureRegionBytes } from '@jbrowse/core/rpc/byteBudget'
import { rpcResult } from '@jbrowse/core/util/librpc'

import { loadMafSamplesAdapter } from '../util/loadMafSamplesAdapter.ts'
import { visibleSamples } from '../util/visibleSamples.ts'
import { buildMafCoverageRegion } from './buildMafCoverageRegion.ts'
import { collectMafTransferables } from './collectTransferables.ts'
import { MafRegionSink } from './mafRegionSink.ts'

import type { MafWireRegionData } from '../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { BaseMafRpcArgs, Sample } from '../types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

export interface LinearMafGetAlignmentDataArgs extends BaseMafRpcArgs {
  // The display's focus, `rows.kept`, as a SET. Rows outside it are neither
  // emitted nor counted in coverage/identity, so a focused clade ships (and
  // scores) only the genomes it draws. No order travels with it: rows name
  // their species and the client places them (see `placeMafRegionData`).
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
    signal,
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
    regions: [region],
    byteLimit,
    signal,
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

  // Rows outside the focus are dropped rather than shipped and hidden. The
  // returned `samples` stays the full set so the sidebar tree + "clear filter"
  // still see every genome.
  //
  // **The packer is given no `reserve`, so its arena and columns grow by
  // doubling, and that is the deliberate trade.** Sizing them exactly needs
  // every block counted before any is encoded, which means holding the whole
  // region's records — and that intermediate, not the memcpy, is what dominates
  // the shape real files have. Buffering to size the arena measured
  // **1.18x slower** and **491 MB against 263 MB** of peak RSS on 20000 blocks
  // of 8 columns; agent-docs reference/MAF_LARGE_BLOCKS.md has the table and
  // the profile behind it.
  const visible = visibleSamples(subtreeFilter, configSamples)
  const sink = new MafRegionSink(visible)
  await adapter.readBlocks(region, sink, opts)
  const { refSampleId } = sink

  const samples: Sample[] = hasConfiguredSamples
    ? configSamples
    : [...sink.discovered].map(id => ({ id, label: id }))

  const packed = sink.packer.finishBlocks()
  const isVisible = (sampleId: string) => !visible || visible.has(sampleId)

  // `packed` already contains exactly the visible rows (narrowed by the subtree
  // filter above), so coverage over them is automatically scoped to the visible
  // subtree — no separate row filtering needed.
  //
  // The reference is normally listed as a sample, so it self-matches at every
  // column; `MafRegionSink` names its row so the conservation metric can
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
