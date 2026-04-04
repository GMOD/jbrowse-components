import { visitCigarOps, visitCsOps } from '@jbrowse/alignments-core'
import Flatbush from '@jbrowse/core/util/flatbush'
import { parseCigar2 } from '@jbrowse/plugin-alignments'

import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'

export interface CigarHitResult {
  type: 'mismatch' | 'insertion' | 'deletion'
  refPosition: number
  length: number
  base?: string
  insertionSeq?: string
}

export interface FeatureHitResult {
  feature: MultiPairFeature
  genomeName: string
  sampleIdx: number
  cigarItem?: CigarHitResult
}

interface CigarIndexEntry {
  featureIdx: number
  sampleIdx: number
  item: CigarHitResult
}

export interface SyntenyFlatbushIndex {
  featureFb: Flatbush
  features: MultiPairFeature[]
  genomeNames: string[]
  cigarFb: Flatbush | undefined
  cigarEntries: CigarIndexEntry[]
}

function collectOpsItems(feat: MultiPairFeature) {
  const items: CigarHitResult[] = []
  const visitor = {
    onMismatch(refPos: number, len: number, queryBase?: string) {
      items.push({
        type: 'mismatch' as const,
        refPosition: refPos,
        length: len,
        base: queryBase?.toUpperCase(),
      })
    },
    onDeletion(refPos: number, len: number) {
      items.push({
        type: 'deletion' as const,
        refPosition: refPos,
        length: len,
      })
    },
    onInsertion(refPos: number, len: number, insertionSeq?: string) {
      items.push({
        type: 'insertion' as const,
        refPosition: refPos,
        length: len,
        insertionSeq,
      })
    },
  }
  if (feat.cs) {
    visitCsOps(feat.cs, feat.start, visitor)
  } else if (feat.cigar) {
    visitCigarOps(parseCigar2(feat.cigar), feat.start, visitor)
  }
  return items
}

export function buildSyntenyIndex(
  genomeRows: Map<string, MultiPairFeature[]>,
  displayedGenomes: string[],
  showSnps: boolean,
) {
  let totalFeatures = 0
  for (const genome of displayedGenomes) {
    const feats = genomeRows.get(genome)
    if (feats) {
      totalFeatures += feats.length
    }
  }

  if (totalFeatures === 0) {
    return undefined
  }

  const featureFb = new Flatbush(totalFeatures)
  const features: MultiPairFeature[] = []
  const genomeNames: string[] = []
  const cigarEntries: CigarIndexEntry[] = []

  for (let g = 0; g < displayedGenomes.length; g++) {
    const genomeName = displayedGenomes[g]!
    const feats = genomeRows.get(genomeName)
    if (!feats) {
      continue
    }
    for (const feat of feats) {
      const featIdx = features.length
      featureFb.add(feat.start, g, feat.end, g)
      features.push(feat)
      genomeNames.push(genomeName)

      if (showSnps && (feat.cs || feat.cigar)) {
        const items = collectOpsItems(feat)
        for (const item of items) {
          cigarEntries.push({ featureIdx: featIdx, sampleIdx: g, item })
        }
      }
    }
  }
  featureFb.finish()

  let cigarFb: Flatbush | undefined
  if (cigarEntries.length > 0) {
    cigarFb = new Flatbush(cigarEntries.length)
    for (const { sampleIdx, item } of cigarEntries) {
      const end =
        item.type === 'insertion'
          ? item.refPosition + 1
          : item.refPosition + item.length
      cigarFb.add(item.refPosition, sampleIdx, end, sampleIdx)
    }
    cigarFb.finish()
  }

  return {
    featureFb,
    features,
    genomeNames,
    cigarFb,
    cigarEntries,
  } satisfies SyntenyFlatbushIndex
}

export function hitTestMultiSynteny(
  mouseX: number,
  mouseY: number,
  rowHeight: number,
  labelW: number,
  view: {
    pxToBp: (px: number) => { offset: number; start: number }
  },
  index: SyntenyFlatbushIndex | undefined,
): FeatureHitResult | undefined {
  if (!index || mouseX < labelW || mouseY < 0) {
    return undefined
  }

  const sampleIdx = Math.floor(mouseY / rowHeight)
  const bp = view.pxToBp(mouseX)
  const coord = bp.start + bp.offset

  // Check mismatch index first for sub-feature detail
  let cigarItem: CigarHitResult | undefined
  if (index.cigarFb) {
    const cigarHits = index.cigarFb.search(coord, sampleIdx, coord, sampleIdx)
    if (cigarHits.length > 0) {
      const entry = index.cigarEntries[cigarHits[0]!]!
      cigarItem = entry.item
    }
  }

  const hits = index.featureFb.search(coord, sampleIdx, coord, sampleIdx)
  if (hits.length === 0) {
    return undefined
  }

  const featIdx = hits[0]!
  const feat = index.features[featIdx]!
  const genomeName = index.genomeNames[featIdx]!

  return { feature: feat, genomeName, sampleIdx, cigarItem }
}
