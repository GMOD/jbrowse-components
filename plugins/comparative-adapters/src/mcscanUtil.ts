import { SimpleFeature, doesIntersect2 } from '@jbrowse/core/util'

import { parseBed, readFiles } from './util.ts'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'
import type { GenericFilehandle } from 'generic-filehandle2'

// A BED gene row parsed by parseBed: one endpoint of a synteny link.
export interface BareFeature {
  strand: number
  refName: string
  start: number
  end: number
  score: number
  name: string
}

// A synteny link between two BED features (assemblyNames[0] side and
// assemblyNames[1] side) tagged with the source row number. `strand` is the
// orientation of the pair: the product of the two BED strands for a gene-to-gene
// link, or the file's own orientation column for a `.anchors.simple` block,
// which is why it is resolved by the caller rather than recomputed here.
// `score` overrides the BED score on the emitted feature (the anchors files
// carry a per-link score; the blocks file does not). Shared by the three MCScan
// adapters, whose getFeatures/getRefNames are otherwise identical.
export interface BlockRow {
  a: BareFeature
  b: BareFeature
  rowNum: number
  strand: number
  score?: number
  // Numeric columns the source file carried past its gene columns, named by
  // config — `identity`, `dn`/`ds`, `goc_score`. They ride onto the feature so a
  // colorBy mode or the detail panel can read them; the format itself is only
  // gene ids, so a table with none is the ordinary case.
  attrs?: Record<string, number> | undefined
}

// The two BED sides of a link joined by name, or undefined when either gene is
// absent from its BED — an anchors/blocks file naming a gene the BED does not
// have is a row that cannot be drawn, not a reason to fail the whole track.
export function joinBedPair(
  bedA: Map<string, BareFeature>,
  bedB: Map<string, BareFeature>,
  nameA: string | undefined,
  nameB: string | undefined,
) {
  const a = nameA === undefined ? undefined : bedA.get(nameA)
  const b = nameB === undefined ? undefined : bedB.get(nameB)
  return a && b ? { a, b } : undefined
}

// A file whose every row failed to join is a misconfiguration (swapped or
// unrelated BEDs), not missing genes: that is worth an error naming the file,
// where silently drawing nothing looks like an empty region.
function checkAnyRowsJoined(rows: BlockRow[], sourceRows: number) {
  if (sourceRows > 0 && rows.length === 0) {
    throw new Error(
      `none of the ${sourceRows} rows in this file name genes present in both BED files; check that bed1Location and bed2Location match it`,
    )
  }
  return rows
}

// The score column of an anchors row. A column the file never wrote, or wrote
// as `.`, is a missing value rather than a zero, and `+undefined` is a NaN that
// rode all the way out onto the feature and into the detail panel. Undefined
// instead leaves the BED's own score in place, which is the same call parseBed
// already makes for the BED's score column.
export function anchorScore(raw: string | undefined) {
  const value = Number(raw)
  return Number.isFinite(value) ? value : undefined
}

// One joined row of an anchors file, given that row's columns and a join bound
// to the two BEDs. The two anchors formats differ in nothing else: `.anchors`
// names one gene pair per row, `.anchors.simple` names the four genes bounding
// a block.
export type AnchorsRowParser = (
  cols: string[],
  join: (
    nameA: string | undefined,
    nameB: string | undefined,
  ) => { a: BareFeature; b: BareFeature } | undefined,
  rowNum: number,
) => BlockRow | undefined

// The shared body of both anchors adapters: read the anchors file and its two
// BEDs together, drop the `###` block separators, and join every row through
// the BEDs. Only `parseRow` differs between them, so it is the only thing each
// adapter supplies. Free function rather than a shared base class for the
// reason util.ts's getAssemblyNamesFromConf documents: a base generic over the
// config cannot prove its slot names to getConf, and each adapter keeps its own
// concrete config type this way.
export async function readAnchorsPair(
  {
    bed1,
    bed2,
    anchors,
  }: {
    bed1: GenericFilehandle
    bed2: GenericFilehandle
    anchors: GenericFilehandle
  },
  opts: BaseOptions | undefined,
  parseRow: AnchorsRowParser,
) {
  const [bed1text, bed2text, anchorstext] = await readFiles(
    [bed1, bed2, anchors],
    opts,
  )
  const bed1Map = parseBed(bed1text!)
  const bed2Map = parseBed(bed2text!)
  const join = (nameA: string | undefined, nameB: string | undefined) =>
    joinBedPair(bed1Map, bed2Map, nameA, nameB)
  const lines = anchorstext!.split(/\n|\r\n|\r/).filter(f => !!f && f !== '###')
  return checkAnyRowsJoined(
    lines
      .map((line, rowNum) => parseRow(line.split('\t'), join, rowNum))
      .filter(f => f !== undefined),
    lines.length,
  )
}

// The sides of a link that face `assemblyName`. Normally one, but a
// self-alignment (a MCScanX whole-genome-duplication run, say) names the same
// assembly on both sides, and then both do: the two copies of a duplicated
// block are each other's mate, so a query has to answer for either one.
function facingSides(
  assemblyNames: string[],
  assemblyName: string | undefined,
) {
  return assemblyNames.flatMap((name, idx) =>
    name === assemblyName ? [idx] : [],
  )
}

// refNames of the given assembly across all links (the side that faces it).
export function getBlockRefNames(
  assemblyNames: string[],
  feats: BlockRow[],
  assemblyName: string | undefined,
) {
  const set = new Set<string>()
  for (const idx of facingSides(assemblyNames, assemblyName)) {
    for (const { a, b } of feats) {
      set.add(idx === 0 ? a.refName : b.refName)
    }
  }
  return [...set]
}

// The links overlapping `region`, oriented so the feature faces the queried
// assembly and its partner is the mate.
//
// `idPrefix` distinguishes one pair's ids from another's when a caller emits
// several pairs into the same fetch (a blocks table queried with no target
// assembly): row 12 of the grape/peach join and row 12 of the grape/cacao join
// are different links. Empty for a caller with only one pair to emit.
export function makeBlockFeatures(
  assemblyNames: string[],
  feats: BlockRow[],
  region: Region,
  idPrefix = '',
) {
  const out: Feature[] = []
  for (const index of facingSides(assemblyNames, region.assemblyName)) {
    const mateIndex = index === 0 ? 1 : 0
    for (const { a, b, rowNum, strand, score, attrs } of feats) {
      const [f1, f2] = index === 0 ? [a, b] : [b, a]
      if (
        f1.refName === region.refName &&
        doesIntersect2(region.start, region.end, f1.start, f1.end)
      ) {
        out.push(
          new SimpleFeature({
            // first, so a column named after one of the feature's own fields
            // cannot displace the coordinate the BED placed it at — a table is
            // free to name its columns anything
            ...attrs,
            ...f1,
            uniqueId: `${idPrefix}${index}-${rowNum}`,
            syntenyId: rowNum,
            strand,
            assemblyName: assemblyNames[index]!,
            ...(score === undefined ? undefined : { score }),
            mate: {
              ...f2,
              assemblyName: assemblyNames[mateIndex]!,
            },
          }),
        )
      }
    }
  }
  return out
}
