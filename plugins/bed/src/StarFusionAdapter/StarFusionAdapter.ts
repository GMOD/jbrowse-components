import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { SimpleFeature, fetchAndMaybeUnzip } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { parseLineByLine } from '@jbrowse/core/util/parseLineByLine'

import {
  buildPairedIntervalTree,
  intervalTreeFeatures,
} from '../adapterUtil.ts'

import type { StarFusionAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, IntervalTree, Region } from '@jbrowse/core/util'

/**
 * A STAR-Fusion `refName:pos:strand` breakpoint, read from the RIGHT: a refName
 * may contain colons. GRCh38's full analysis set names its HLA contigs
 * `HLA-A*01:01:01:01`, so a breakpoint on one arrives as
 * `HLA-A*01:01:01:01:5000:+` and splitting at the first colon read the contig as
 * `HLA-A*01`, the position as 1 and the strand as absent. Same rule
 * `parseSvAlt` applies to a BND mate locstring, one field further along.
 *
 * A string with fewer than three fields keeps what it always parsed to, so a
 * truncated or strandless row is no worse off than before.
 */
function parseBreakpoint(str: string) {
  const parts = str.split(':')
  const strandStr = parts.length >= 3 ? parts.pop() : undefined
  const pos = parts.length >= 2 ? +parts.pop()! : Number.NaN
  return {
    refName: parts.join(':'),
    start: pos,
    end: pos + 1,
    strand: strandStr === '+' ? 1 : strandStr === '-' ? -1 : undefined,
  }
}

/**
 * Which way the sequence a breakpoint keeps runs from it, as the paired-arc
 * display's mate-direction tick (1 = right, -1 = left, 0 = unknown). A
 * breakpoint's strand in STAR-Fusion is its gene's transcription strand, and the
 * fusion transcript keeps the donor's sequence 5' of the junction and the
 * acceptor's 3' of it: so on a + strand donor the retained side is at lower
 * coordinates and on a + strand acceptor it is at higher ones.
 */
function tickDirection(strand: number | undefined, isDonor: boolean) {
  return strand === undefined ? 0 : isDonor ? -strand : strand
}

export default class StarFusionAdapter extends BaseFeatureDataAdapter<StarFusionAdapterConfig> {
  protected fileData?: Promise<{
    columnNames: string[]
    feats1: Record<string, string[]>
    feats2: Record<string, string[]>
  }>

  protected intervalTrees: Record<
    string,
    Promise<IntervalTree<Feature> | undefined> | undefined
  > = {}

  public static capabilities = ['getFeatures', 'getRefNames']

  private async loadDataP(opts?: BaseOptions) {
    const buffer = await fetchAndMaybeUnzip(
      openLocation(this.getConf('starFusionLocation'), this.pluginManager),
      opts,
    )

    let columnNames: string[] = []
    let leftIdx = -1
    let rightIdx = -1
    const feats1: Record<string, string[]> = {}
    const feats2: Record<string, string[]> = {}

    parseLineByLine(
      buffer,
      line => {
        if (line.startsWith('#')) {
          columnNames = line.slice(1).split('\t')
          leftIdx = columnNames.indexOf('LeftBreakpoint')
          rightIdx = columnNames.indexOf('RightBreakpoint')
        } else if (leftIdx >= 0 && rightIdx >= 0) {
          const cols = line.split('\t')
          const left = cols[leftIdx]
          const right = cols[rightIdx]
          // through parseBreakpoint, so the bucket a row is filed under is the
          // refName its feature will report -- a colon-bearing contig split two
          // ways puts the row in a bucket no query can reach
          const leftRef = left ? parseBreakpoint(left).refName : undefined
          const rightRef = right ? parseBreakpoint(right).refName : undefined
          if (leftRef && rightRef) {
            ;(feats1[leftRef] ??= []).push(line)
            ;(feats2[rightRef] ??= []).push(line)
          }
        }
        return true
      },
      opts?.statusCallback,
    )

    return { columnNames, feats1, feats2 }
  }

  private async loadData(opts: BaseOptions = {}) {
    this.fileData ??= this.loadDataP(opts).catch((e: unknown) => {
      this.fileData = undefined
      throw e
    })
    return this.fileData
  }

  public async getRefNames(opts: BaseOptions = {}) {
    const { feats1, feats2 } = await this.loadData(opts)
    return [...new Set([...Object.keys(feats1), ...Object.keys(feats2)])]
  }

  private featureFromLine(
    line: string,
    columnNames: string[],
    uniqueId: string,
    flip: boolean,
  ): Feature {
    const cols = line.split('\t')
    const row = Object.fromEntries(
      columnNames.map((name, i) => [name, cols[i]]),
    )
    const primaryBp = parseBreakpoint(
      (flip ? row.RightBreakpoint : row.LeftBreakpoint)!,
    )
    const mateBp = parseBreakpoint(
      (flip ? row.LeftBreakpoint : row.RightBreakpoint)!,
    )
    // the LeftBreakpoint is the donor, so this feature is the donor end of the
    // junction whenever it is not flipped, and the mate is the other end
    return new SimpleFeature({
      uniqueId,
      refName: primaryBp.refName,
      start: primaryBp.start,
      end: primaryBp.end,
      strand: primaryBp.strand,
      mateDirection: tickDirection(primaryBp.strand, !flip),
      name: row.FusionName,
      score: row.JunctionReadCount ? +row.JunctionReadCount : undefined,
      type: 'fusion',
      mate: {
        refName: mateBp.refName,
        start: mateBp.start,
        end: mateBp.end,
        strand: mateBp.strand,
        mateDirection: tickDirection(mateBp.strand, flip),
      },
      ...row,
    })
  }

  private async loadFeatureTreeP(refName: string) {
    const { columnNames, feats1, feats2 } = await this.loadData()
    return buildPairedIntervalTree(
      feats1,
      feats2,
      refName,
      this.id,
      (line, uniqueId, flip) =>
        this.featureFromLine(line, columnNames, uniqueId, flip),
    )
  }

  private async loadFeatureTree(refName: string) {
    this.intervalTrees[refName] ??= this.loadFeatureTreeP(refName).catch(
      (e: unknown) => {
        this.intervalTrees[refName] = undefined
        throw e
      },
    )
    return this.intervalTrees[refName]
  }

  public getFeatures(query: Region, opts: BaseOptions = {}) {
    return intervalTreeFeatures(query, opts, refName =>
      this.loadFeatureTree(refName),
    )
  }
}
