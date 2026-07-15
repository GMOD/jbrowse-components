import { SimpleFeature, doesIntersect2 } from '@jbrowse/core/util'

import type { Feature, Region } from '@jbrowse/core/util'

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
// assemblyNames[1] side) tagged with the source row number. `score` overrides
// the BED score on the emitted feature (the anchors file carries a per-link
// score; the blocks file does not). Shared by MCScanAnchorsAdapter and
// MCScanBlocksAdapter, whose getFeatures/getRefNames are otherwise identical.
export interface BlockRow {
  a: BareFeature
  b: BareFeature
  rowNum: number
  score?: number
}

// refNames of the given assembly across all links (the side that faces it).
export function getBlockRefNames(
  assemblyNames: string[],
  feats: BlockRow[],
  assemblyName: string | undefined,
) {
  const idx =
    assemblyName === undefined ? -1 : assemblyNames.indexOf(assemblyName)
  const set = new Set<string>()
  if (idx !== -1) {
    for (const { a, b } of feats) {
      set.add(idx === 0 ? a.refName : b.refName)
    }
  }
  return [...set]
}

// The links overlapping `region`, oriented so the feature faces the queried
// assembly and its partner is the mate. strand is the product of the two BED
// strands (-1 when the pair is inverted).
export function makeBlockFeatures(
  assemblyNames: string[],
  feats: BlockRow[],
  region: Region,
) {
  const index = assemblyNames.indexOf(region.assemblyName)
  const out: Feature[] = []
  if (index !== -1) {
    const flip = index === 0
    for (const { a, b, rowNum, score } of feats) {
      const [f1, f2] = flip ? [a, b] : [b, a]
      if (
        f1.refName === region.refName &&
        doesIntersect2(region.start, region.end, f1.start, f1.end)
      ) {
        out.push(
          new SimpleFeature({
            ...f1,
            uniqueId: `${index}-${rowNum}`,
            syntenyId: rowNum,
            strand: f1.strand * f2.strand,
            assemblyName: assemblyNames[+!flip]!,
            ...(score === undefined ? undefined : { score }),
            mate: {
              ...f2,
              assemblyName: assemblyNames[+flip]!,
            },
          }),
        )
      }
    }
  }
  return out
}
