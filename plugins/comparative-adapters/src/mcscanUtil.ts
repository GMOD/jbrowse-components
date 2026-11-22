import { SimpleFeature, doesIntersect2 } from '@jbrowse/core/util'

import { getOrCreate, parseBed, readFiles } from './util.ts'

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
  // How many genes share this link's ortholog, the larger side's count: 1 for a
  // one-to-one pair, 3 for each link of a tandem triple against one gene. Unset
  // on an `.anchors.simple` row, which bounds a block rather than naming a pair.
  syntenicDepth?: number
  // Columns the source file carried past its gene columns, named by config
  // (`identity`, `dn`/`ds`, `goc_score`), and the `block` and `blockSpan` an
  // `.anchors` file's `###` sections give each pair. They ride onto the feature
  // so a colorBy mode or the detail panel can read them; the format itself is
  // only gene ids, so a table with none is the ordinary case.
  attrs?: Record<string, number | string> | undefined
  blockExtent?: BlockExtent
}

// Where a pair's `###` block reaches on each side, and the way it runs: -1
// where gene order on one side falls as it rises on the other.
interface BlockExtent {
  a: readonly [number, number]
  b: readonly [number, number]
  strand: number
}

// How many distinct genes each gene links to over `links` (gene name pairs
// between two genomes), keyed `assembly\tgene` so a self-comparison pools both
// sides of one genome.
export function partnerCounts(
  assemblyA: string,
  assemblyB: string,
  links: Iterable<readonly [string, string]>,
) {
  const partners = new Map<string, Set<string>>()
  const link = (gene: string, partner: string) => {
    getOrCreate(partners, gene, () => new Set()).add(partner)
  }
  for (const [nameA, nameB] of links) {
    link(`${assemblyA}\t${nameA}`, `${assemblyB}\t${nameB}`)
    link(`${assemblyB}\t${nameB}`, `${assemblyA}\t${nameA}`)
  }
  return new Map([...partners].map(([gene, set]) => [gene, set.size]))
}

// A link's syntenic depth under `partnerCounts`: the larger of its two genes'.
export function syntenicDepthOf(
  counts: Map<string, number>,
  assemblyA: string,
  nameA: string,
  assemblyB: string,
  nameB: string,
) {
  return Math.max(
    counts.get(`${assemblyA}\t${nameA}`) ?? 1,
    counts.get(`${assemblyB}\t${nameB}`) ?? 1,
  )
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

function ranksAlongContig(bed: Map<string, BareFeature>) {
  const byRefName = new Map<string, BareFeature[]>()
  for (const gene of bed.values()) {
    getOrCreate(byRefName, gene.refName, () => []).push(gene)
  }
  const ranks = new Map<string, number>()
  for (const genes of byRefName.values()) {
    genes
      .toSorted((x, y) => x.start - y.start || (x.name < y.name ? -1 : 1))
      .forEach((gene, rank) => ranks.set(gene.name, rank))
  }
  return ranks
}

function rankSpan(ranks: Map<string, number>, names: string[]) {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const name of names) {
    const rank = ranks.get(name)
    if (rank !== undefined) {
      min = Math.min(min, rank)
      max = Math.max(max, rank)
    }
  }
  return max - min + 1
}

function reach(genes: BareFeature[]) {
  let start = Number.POSITIVE_INFINITY
  let end = Number.NEGATIVE_INFINITY
  for (const gene of genes) {
    start = Math.min(start, gene.start)
    end = Math.max(end, gene.end)
  }
  return [start, end] as const
}

function runsAgainst(
  ranksA: Map<string, number>,
  ranksB: Map<string, number>,
  rows: BlockRow[],
) {
  const pairs = rows.flatMap(row => {
    const a = ranksA.get(row.a.name)
    const b = ranksB.get(row.b.name)
    return a === undefined || b === undefined ? [] : [[a, b] as const]
  })
  const meanA = pairs.reduce((sum, [a]) => sum + a, 0) / pairs.length
  const meanB = pairs.reduce((sum, [, b]) => sum + b, 0) / pairs.length
  return pairs.reduce((sum, [a, b]) => sum + (a - meanA) * (b - meanB), 0) < 0
}

// `block` is text, which paints a color per value; `blockSpan` is the measure
// jcvi's `screen --minspan` keeps a block by.
function withBlockFields(
  sections: BlockRow[][],
  bedA: Map<string, BareFeature>,
  bedB: Map<string, BareFeature>,
) {
  const ranksA = ranksAlongContig(bedA)
  const ranksB = ranksAlongContig(bedB)
  return sections.flatMap((rows, index) => {
    const blockSpan = Math.min(
      rankSpan(
        ranksA,
        rows.map(row => row.a.name),
      ),
      rankSpan(
        ranksB,
        rows.map(row => row.b.name),
      ),
    )
    const blockExtent = {
      a: reach(rows.map(row => row.a)),
      b: reach(rows.map(row => row.b)),
      strand: runsAgainst(ranksA, ranksB, rows) ? -1 : 1,
    }
    return rows.map(row => ({
      ...row,
      attrs: { ...row.attrs, block: `block${index}`, blockSpan },
      blockExtent,
    }))
  })
}

// The shared body of both anchors adapters: read the anchors file and its two
// BEDs together and join every row through the BEDs. Only `parseRow` differs
// between them, so it is the only thing each adapter supplies. `rowNum` counts
// the rows and not the `###` lines between them, so a row's id is its place
// among the pairs. Only gene pairs take a block from their `###` section: a
// `.anchors.simple` row is a block already.
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
  genePairs: boolean,
) {
  const [bed1text, bed2text, anchorstext] = await readFiles(
    [bed1, bed2, anchors],
    opts,
  )
  const bed1Map = parseBed(bed1text!)
  const bed2Map = parseBed(bed2text!)
  const join = (nameA: string | undefined, nameB: string | undefined) =>
    joinBedPair(bed1Map, bed2Map, nameA, nameB)
  const unsectioned: BlockRow[] = []
  const sections: BlockRow[][] = []
  let section = unsectioned
  let sourceRows = 0
  for (const line of anchorstext!.split(/\n|\r\n|\r/)) {
    if (line === '###') {
      if (genePairs) {
        section = []
        sections.push(section)
      }
    } else if (line) {
      const row = parseRow(line.split('\t'), join, sourceRows++)
      if (row !== undefined) {
        section.push(row)
      }
    }
  }
  return checkAnyRowsJoined(
    sections.length > 0
      ? [...unsectioned, ...withBlockFields(sections, bed1Map, bed2Map)]
      : unsectioned,
    sourceRows,
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

/**
 * A joined row set plus, per side, its rows bucketed by that side's refName.
 *
 * A query names one refName, and every MCScan format holds its whole file in
 * memory, so without the buckets each query walked every row in the file to
 * find the ones on one contig — once per region. A whole-genome synteny view
 * asks for one region per displayed contig on each axis, which made the fetch
 * quadratic in a file's own contig count: 29 grape regions against the 15,265
 * joined rows of jcvi's grape/peach anchors is 442,685 row visits to emit
 * 15,265 features.
 *
 * Built per side on first use rather than for both up front, since a pairwise
 * track only ever queries the side its axis faces — both get built only for a
 * self-alignment, or for the two-axis fetch, which do ask about both.
 */
export interface BlockRowIndex {
  rows: BlockRow[]
  bySide: (side: number) => Map<string, BlockRow[]>
}

export function indexBlockRows(rows: BlockRow[]): BlockRowIndex {
  const sides: (Map<string, BlockRow[]> | undefined)[] = []
  return {
    rows,
    bySide(side: number) {
      let buckets = sides[side]
      if (buckets === undefined) {
        buckets = new Map()
        for (const row of rows) {
          const refName = side === 0 ? row.a.refName : row.b.refName
          getOrCreate(buckets, refName, () => []).push(row)
        }
        sides[side] = buckets
      }
      return buckets
    },
  }
}

// refNames of the given assembly across all links (the side that faces it).
export function getBlockRefNames(
  assemblyNames: string[],
  index: BlockRowIndex,
  assemblyName: string | undefined,
) {
  const set = new Set<string>()
  for (const side of facingSides(assemblyNames, assemblyName)) {
    for (const refName of index.bySide(side).keys()) {
      set.add(refName)
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
  index: BlockRowIndex,
  region: Region,
  idPrefix = '',
) {
  const out: Feature[] = []
  for (const side of facingSides(assemblyNames, region.assemblyName)) {
    const rows = index.bySide(side).get(region.refName)
    if (rows === undefined) {
      continue
    }
    const first = side === 0
    const assemblyName = assemblyNames[side]!
    const mateAssemblyName = assemblyNames[first ? 1 : 0]!
    for (const {
      a,
      b,
      rowNum,
      strand,
      score,
      syntenicDepth,
      attrs,
      blockExtent,
    } of rows) {
      const f1 = first ? a : b
      const [blockStart, blockEnd] =
        (first ? blockExtent?.a : blockExtent?.b) ?? []
      const [blockMateStart, blockMateEnd] =
        (first ? blockExtent?.b : blockExtent?.a) ?? []
      if (doesIntersect2(region.start, region.end, f1.start, f1.end)) {
        out.push(
          new SimpleFeature({
            // first, so a column named after one of the feature's own fields
            // cannot displace the coordinate the BED placed it at — a table is
            // free to name its columns anything
            ...attrs,
            ...f1,
            uniqueId: `${idPrefix}${side}-${rowNum}`,
            syntenyId: rowNum,
            strand,
            assemblyName,
            ...(score === undefined ? undefined : { score }),
            ...(syntenicDepth === undefined ? undefined : { syntenicDepth }),
            ...(blockExtent === undefined
              ? undefined
              : {
                  blockStart,
                  blockEnd,
                  blockMateStart,
                  blockMateEnd,
                  blockStrand: blockExtent.strand,
                }),
            mate: {
              ...(first ? b : a),
              assemblyName: mateAssemblyName,
            },
          }),
        )
      }
    }
  }
  return out
}

// A mate placement as a grouped feature lists it: the pairwise mate's fields
// less the BED score, plus the pair's own orientation, which the pairwise
// feature carried as its top-level `strand`.
export interface GroupedMate {
  assemblyName: string
  refName: string
  start: number
  end: number
  strand: number
  orientation: number
  name: string
  /** the table row stating this pair, so two mates of one row are a stated pair */
  row: number
}

// One anchor gene's rows folded together: where the anchor sits, which column
// and row first named it, and every mate placement its pairs reach.
export interface GroupedRow {
  anchor: BareFeature
  anchorCol: number
  rowNum: number
  attrs: Record<string, number | string> | undefined
  mates: GroupedMate[]
}

// The links `makeBlockFeatures` would emit for this pair over `region`, folded
// into `groups` by anchor gene name rather than emitted one per link. Walks
// the same indexed rows, so the join and the per-pair dedupe are the pairwise
// path's; what differs is the object count on the way out. A caller runs it
// once per column pair into one map, then `makeGroupedFeatures` emits.
export function collectGroupedRows(
  assemblyNames: string[],
  columns: [number, number],
  index: BlockRowIndex,
  region: Region,
  groups: Map<string, GroupedRow>,
) {
  for (const side of facingSides(assemblyNames, region.assemblyName)) {
    const rows = index.bySide(side).get(region.refName)
    if (rows !== undefined) {
      const first = side === 0
      const mateAssemblyName = assemblyNames[first ? 1 : 0]!
      for (const { a, b, rowNum, strand, attrs } of rows) {
        const anchor = first ? a : b
        if (
          doesIntersect2(region.start, region.end, anchor.start, anchor.end)
        ) {
          let group = groups.get(anchor.name)
          if (group === undefined) {
            group = {
              anchor,
              anchorCol: columns[first ? 0 : 1],
              rowNum,
              attrs,
              mates: [],
            }
            groups.set(anchor.name, group)
          }
          const mate = first ? b : a
          group.mates.push({
            assemblyName: mateAssemblyName,
            refName: mate.refName,
            start: mate.start,
            end: mate.end,
            strand: mate.strand,
            orientation: strand,
            name: mate.name,
            row: rowNum,
          })
        }
      }
    }
  }
}

// The grouped answer: one feature per anchor gene, `strand` the gene's own BED
// strand (each mate carries the pairwise orientation instead), id keyed on the
// column and row that first named the gene so it stays put across fetches.
export function makeGroupedFeatures(
  assemblyName: string,
  groups: Map<string, GroupedRow>,
) {
  return [...groups.values()].map(
    ({ anchor, anchorCol, rowNum, attrs, mates }) =>
      new SimpleFeature({
        ...attrs,
        ...anchor,
        uniqueId: `${anchorCol}-${rowNum}`,
        syntenyId: rowNum,
        assemblyName,
        mates,
      }),
  )
}
