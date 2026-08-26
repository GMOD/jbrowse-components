import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { updateStatus } from '@jbrowse/core/util'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

import {
  contactsForRecord,
  depthBin,
  isOffDiagonalOnly,
  isPrimaryAligned,
} from './contactChannels.ts'

import type {
  ContactAdapter,
  HicContactOptions,
  MultiRegionContacts,
  RegionPairRun,
} from '../HicAdapter/HicAdapter.ts'
import type { AlignmentRecord, ContactChannel } from './contactChannels.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util/simpleFeature'
import type { Region } from '@jbrowse/core/util/types'

/**
 * Ceiling on the cells `depthDifference` will build. Every bin pair inside the
 * view is a cell, so the count is quadratic in the span and a whole chromosome
 * at the finest bin size is tens of millions — enough to stall the worker
 * building a matrix no screen can show. Over the cap the channel steps to the
 * next coarser bin size, and the resolution it actually used comes back in the
 * result, so the display labels what it drew. The display picks a bin size from
 * bpPerPx, which keeps the ordinary path well under this: the cap is a guard on
 * a view wider than the finest bin size was meant for.
 */
const MAX_DEPTH_CELLS = 2_000_000

/** bin1 -> bin2 -> summed count, for one region pair. */
type PairCells = Map<number, Map<number, number>>

function addCell(cells: PairCells, bin1: number, bin2: number, count: number) {
  let row = cells.get(bin1)
  if (!row) {
    row = new Map()
    cells.set(bin1, row)
  }
  row.set(bin2, (row.get(bin2) ?? 0) + count)
}

function countCells(cells: PairCells) {
  let n = 0
  for (const row of cells.values()) {
    n += row.size
  }
  return n
}

/** Every `(i, j)` with `i <= j`, in the order the run table has to end up in. */
function regionPairIndices(regions: Region[]) {
  const pairs: [number, number][] = []
  for (let i = 0; i < regions.length; i++) {
    for (let j = i; j < regions.length; j++) {
      pairs.push([i, j])
    }
  }
  return pairs
}

function binsInRegion(region: Region, resolution: number) {
  return {
    first: Math.floor(region.start / resolution),
    last: Math.floor((region.end - 1) / resolution),
  }
}

function containsPosition(region: Region, refName: string, pos: number) {
  return refName === region.refName && pos >= region.start && pos < region.end
}

function forEachFeature(
  observable: ReturnType<BaseFeatureDataAdapter['getFeatures']>,
  consume: (feature: Feature) => void,
) {
  return new Promise<void>((resolve, reject) => {
    observable.subscribe({ next: consume, error: reject, complete: resolve })
  })
}

function readTag(feature: Feature, tag: string) {
  const targeted = (feature as unknown as { getTag?: (t: string) => unknown })
    .getTag
  const value = targeted
    ? targeted.call(feature, tag)
    : (feature.get('tags') as Record<string, unknown> | undefined)?.[tag]
  return typeof value === 'string' ? value : undefined
}

function toRecord(feature: Feature): AlignmentRecord {
  return {
    refName: feature.get('refName'),
    start: feature.get('start'),
    end: feature.get('end'),
    strand: feature.get('strand') ?? 0,
    flags: (feature.get('flags') as number | undefined) ?? 0,
    nextRefName: feature.get('next_ref') as string | undefined,
    nextPos: feature.get('next_pos') as number | undefined,
    sa: readTag(feature, 'SA'),
  }
}

/**
 * A contact matrix built live from an alignments file, so Cue's SV contact map
 * can be looked at without a juicer preprocess: a `HicTrack` whose adapter is
 * this one reads a BAM/CRAM and hands `LinearHicDisplay` the same struct of
 * arrays a `.hic` file would.
 *
 * Region-limited by design, like the pileup — the contacts come from the reads
 * in the current view, and there is no summary to fall back on when zoomed out.
 *
 * A read emits only where its own start falls inside the region being scanned.
 * Displayed blocks tile the view without overlapping, so that is what keeps a
 * pair from being counted twice by the two fetches a read at a block boundary
 * lands in; what it costs is the reads that start left of the leftmost block.
 */
export default class AlignmentsContactAdapter
  extends BaseFeatureDataAdapter
  implements ContactAdapter
{
  private subadapterP: Promise<BaseFeatureDataAdapter> | undefined

  private get binSizes(): number[] {
    const sizes = this.getConf('binSizes') as number[]
    return [...sizes].sort((a, b) => a - b)
  }

  private get channel() {
    return this.getConf('channel') as ContactChannel
  }

  private async configure() {
    this.subadapterP ??= this.loadSubadapter().catch((e: unknown) => {
      this.subadapterP = undefined
      throw e
    })
    return this.subadapterP
  }

  private async loadSubadapter() {
    const conf = this.getConf('subadapter') as Record<string, unknown> | null
    if (!conf?.type) {
      throw new Error('AlignmentsContactAdapter: no subadapter configured')
    }
    if (!this.getSubAdapter) {
      throw new Error('no getSubAdapter available')
    }
    const { dataAdapter } = await this.getSubAdapter(conf)
    const adapter = dataAdapter as BaseFeatureDataAdapter
    // CRAM decodes against the reference, and only the enclosing track's RPC
    // knows which assembly that is — pass on what it primed us with.
    adapter.setSequenceAdapterConfig(this.sequenceAdapterConfig)
    return adapter
  }

  /**
   * The bin sizes the display may pick from, finest first, and `NONE` — nothing
   * here is normalized, so there is one scheme to offer.
   *
   * Every bin size is offered whatever the view, and `depthDifference` may
   * still decline the finest one: its cell count is quadratic in the span, so a
   * view wide enough to blow {@link MAX_DEPTH_CELLS} comes back at a coarser
   * bin size than the one requested. The result carries the bin size it was
   * built at, so the display labels what it drew.
   */
  public async getHeader(_opts?: BaseOptions) {
    return { norms: ['NONE'], resolutions: this.binSizes }
  }

  public async getRefNames(opts?: BaseOptions) {
    const adapter = await this.configure()
    return adapter.getRefNames(opts)
  }

  /**
   * Contacts are not a per-region feature stream — the display fetches them
   * through `getMultiRegionContactRecords`. This satisfies the abstract
   * `BaseFeatureDataAdapter` contract, as it does on `HicAdapter`.
   */
  public getFeatures(_region: Region, _opts?: BaseOptions) {
    return ObservableCreate<Feature>(observer => {
      observer.complete()
    })
  }

  public async getMultiRegionContactRecords(
    regions: Region[],
    opts: HicContactOptions,
  ): Promise<MultiRegionContacts> {
    const channel = this.channel
    return channel === 'depthDifference'
      ? this.depthDifferenceRecords(regions, opts)
      : this.pairRecords(regions, channel, opts)
  }

  private async pairRecords(
    regions: Region[],
    channel: ContactChannel,
    opts: HicContactOptions,
  ): Promise<MultiRegionContacts> {
    const { resolution, statusCallback, stopToken } = opts
    const minSpan = this.getConf('minSpan') as number
    const offDiagonalOnly = isOffDiagonalOnly(channel)
    const pairIndices = regionPairIndices(regions)
    const slotOf = new Map(
      pairIndices.map(([i, j], at) => [i * regions.length + j, at] as const),
    )
    const perPair = pairIndices.map(() => new Map() as PairCells)

    const place = (refName: string, pos1: number, pos2: number) => {
      const i = regions.findIndex(r => containsPosition(r, refName, pos1))
      const j = regions.findIndex(r => containsPosition(r, refName, pos2))
      if (i === -1 || j === -1) {
        return
      }
      const at = slotOf.get(
        i <= j ? i * regions.length + j : j * regions.length + i,
      )!
      const bin1 = Math.floor((i <= j ? pos1 : pos2) / resolution)
      const bin2 = Math.floor((i <= j ? pos2 : pos1) / resolution)
      if (!(offDiagonalOnly && bin1 === bin2)) {
        addCell(perPair[at]!, bin1, bin2, 1)
      }
    }

    const adapter = await this.configure()
    await updateStatus(
      'Building contact matrix',
      statusCallback,
      async () => {
        for (const region of regions) {
          checkStopToken(stopToken)
          await forEachFeature(adapter.getFeatures(region, opts), feature => {
            const record = toRecord(feature)
            if (!containsPosition(region, record.refName, record.start)) {
              return
            }
            for (const c of contactsForRecord(record, { channel, minSpan })) {
              place(c.refName, c.pos1, c.pos2)
            }
          })
        }
      },
      stopToken,
    )

    return packContacts(perPair, pairIndices, resolution)
  }

  private async depthDifferenceRecords(
    regions: Region[],
    opts: HicContactOptions,
  ): Promise<MultiRegionContacts> {
    const { statusCallback, stopToken } = opts
    const resolution = this.depthResolution(regions, opts.resolution)
    const pairIndices = regionPairIndices(regions)
    const perPair = pairIndices.map(() => new Map() as PairCells)
    const depth = new Map<string, Map<number, number>>()

    const adapter = await this.configure()
    await updateStatus(
      'Building depth matrix',
      statusCallback,
      async () => {
        for (const region of regions) {
          checkStopToken(stopToken)
          let bins = depth.get(region.refName)
          if (!bins) {
            bins = new Map()
            depth.set(region.refName, bins)
          }
          const perRef = bins
          await forEachFeature(adapter.getFeatures(region, opts), feature => {
            const record = toRecord(feature)
            if (!isPrimaryAligned(record)) {
              return
            }
            const midpoint = Math.floor((record.start + record.end) / 2)
            if (containsPosition(region, record.refName, midpoint)) {
              const bin = depthBin(record, resolution)
              perRef.set(bin, (perRef.get(bin) ?? 0) + 1)
            }
          })
        }
      },
      stopToken,
    )

    for (const [at, [i, j]] of pairIndices.entries()) {
      const r1 = regions[i]!
      const r2 = regions[j]!
      if (r1.refName !== r2.refName) {
        continue
      }
      const bins = depth.get(r1.refName)
      if (!bins) {
        continue
      }
      const span1 = binsInRegion(r1, resolution)
      const span2 = binsInRegion(r2, resolution)
      const cells = perPair[at]!
      for (let a = span1.first; a <= span1.last; a++) {
        for (let b = Math.max(span2.first, a + 1); b <= span2.last; b++) {
          const diff = Math.abs((bins.get(a) ?? 0) - (bins.get(b) ?? 0))
          if (diff) {
            addCell(cells, a, b, diff)
          }
        }
      }
    }

    return packContacts(perPair, pairIndices, resolution)
  }

  /**
   * The finest configured bin size at or above the requested one whose cell
   * count clears {@link MAX_DEPTH_CELLS}, or the coarsest there is.
   */
  private depthResolution(regions: Region[], requested: number) {
    const candidates = this.binSizes.filter(size => size >= requested)
    return (
      candidates.find(
        size => estimateDepthCells(regions, size) <= MAX_DEPTH_CELLS,
      ) ??
      candidates.at(-1) ??
      requested
    )
  }
}

function estimateDepthCells(regions: Region[], resolution: number) {
  let cells = 0
  for (const [i, j] of regionPairIndices(regions)) {
    const r1 = regions[i]!
    const r2 = regions[j]!
    if (r1.refName !== r2.refName) {
      continue
    }
    const n1 = binsInRegion(r1, resolution)
    const n2 = binsInRegion(r2, resolution)
    const count1 = n1.last - n1.first + 1
    const count2 = n2.last - n2.first + 1
    cells += i === j ? (count1 * (count1 - 1)) / 2 : count1 * count2
  }
  return cells
}

/**
 * The per-pair cell maps as the concatenated arrays plus run table the display
 * consumes, sized exactly: the buffers transfer to the main thread whole, so an
 * oversized one ships its slack too.
 */
function packContacts(
  perPair: PairCells[],
  pairIndices: [number, number][],
  resolution: number,
): MultiRegionContacts {
  const numContacts = perPair.reduce((sum, cells) => sum + countCells(cells), 0)
  const bin1 = new Uint32Array(numContacts)
  const bin2 = new Uint32Array(numContacts)
  const counts = new Float32Array(numContacts)
  const pairs: RegionPairRun[] = []
  let at = 0
  for (const [slot, cells] of perPair.entries()) {
    if (cells.size === 0) {
      continue
    }
    const start = at
    for (const [b1, row] of cells) {
      for (const [b2, count] of row) {
        bin1[at] = b1
        bin2[at] = b2
        counts[at] = count
        at++
      }
    }
    const [region1Idx, region2Idx] = pairIndices[slot]!
    pairs.push({ region1Idx, region2Idx, start, end: at })
  }

  return {
    bin1,
    bin2,
    counts,
    pairs,
    numContacts,
    resolution,
    appliedNormalization: 'NONE',
  }
}
