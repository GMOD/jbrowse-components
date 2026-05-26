import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  IntervalTree,
  SimpleFeature,
  fetchAndMaybeUnzip,
} from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { parseLineByLine } from '@jbrowse/core/util/parseLineByLine'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

function parseBreakpoint(str: string) {
  const [refName, pos, strandStr] = str.split(':')
  return {
    refName: refName!,
    start: +pos!,
    end: +pos! + 1,
    strand: strandStr === '+' ? 1 : strandStr === '-' ? -1 : undefined,
  }
}

export default class StarFusionAdapter extends BaseFeatureDataAdapter {
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
          const leftRef = cols[leftIdx]!.split(':')[0]!
          const rightRef = cols[rightIdx]!.split(':')[0]!
          ;(feats1[leftRef] ??= []).push(line)
          ;(feats2[rightRef] ??= []).push(line)
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
    return new SimpleFeature({
      uniqueId,
      refName: primaryBp.refName,
      start: primaryBp.start,
      end: primaryBp.end,
      strand: primaryBp.strand,
      name: row.FusionName,
      score: row.JunctionReadCount ? +row.JunctionReadCount : undefined,
      type: 'fusion',
      mate: {
        refName: mateBp.refName,
        start: mateBp.start,
        end: mateBp.end,
        strand: mateBp.strand,
      },
      ...row,
    })
  }

  private async loadFeatureTreeP(refName: string) {
    const { columnNames, feats1, feats2 } = await this.loadData()
    const intervalTree = new IntervalTree<Feature>()
    for (const [i, line] of (feats1[refName] ?? []).entries()) {
      const feat = this.featureFromLine(
        line,
        columnNames,
        `${this.id}-${refName}-${i}-r1`,
        false,
      )
      intervalTree.insert([feat.get('start'), feat.get('end')], feat)
    }
    for (const [i, line] of (feats2[refName] ?? []).entries()) {
      const feat = this.featureFromLine(
        line,
        columnNames,
        `${this.id}-${refName}-${i}-r2`,
        true,
      )
      intervalTree.insert([feat.get('start'), feat.get('end')], feat)
    }
    return intervalTree
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
    return ObservableCreate<Feature>(async observer => {
      const { start, end, refName } = query
      const intervalTree = await this.loadFeatureTree(refName)
      for (const f of intervalTree?.search([start, end]) ?? []) {
        observer.next(f)
      }
      observer.complete()
    }, opts.stopToken)
  }
}
