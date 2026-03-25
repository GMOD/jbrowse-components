import { parseCigar2 } from '@jbrowse/plugin-alignments'
import Flatbush from '@jbrowse/core/util/flatbush'

import {
  isDigit,
  isCsOpChar,
  OP_D,
  OP_EQ,
  OP_I,
  OP_M,
  OP_N,
  OP_X,
} from './cigarConstants.ts'

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

function collectCigarItems(
  cigar: number[],
  featStart: number,
): CigarHitResult[] {
  const items: CigarHitResult[] = []
  let refPos = featStart
  for (const packed of cigar) {
    const len = packed >>> 4
    const op = packed & 0xf
    if (op === OP_M || op === OP_EQ) {
      refPos += len
    } else if (op === OP_X) {
      items.push({ type: 'mismatch', refPosition: refPos, length: len })
      refPos += len
    } else if (op === OP_D || op === OP_N) {
      items.push({ type: 'deletion', refPosition: refPos, length: len })
      refPos += len
    } else if (op === OP_I) {
      items.push({ type: 'insertion', refPosition: refPos, length: len })
    }
  }
  return items
}

function collectCsItems(cs: string, featStart: number): CigarHitResult[] {
  const items: CigarHitResult[] = []
  let refPos = featStart
  let i = 0

  while (i < cs.length) {
    const ch = cs[i]!
    if (ch === ':') {
      i++
      let num = 0
      while (i < cs.length && isDigit(cs[i]!)) {
        num = num * 10 + (cs.charCodeAt(i) - 48)
        i++
      }
      refPos += num
    } else if (ch === '*') {
      const queryBase = cs[i + 2] ?? ''
      items.push({
        type: 'mismatch',
        refPosition: refPos,
        length: 1,
        base: queryBase.toUpperCase(),
      })
      i += 3
      refPos += 1
    } else if (ch === '-') {
      i++
      let len = 0
      while (i < cs.length && !isCsOpChar(cs[i])) {
        len++
        i++
      }
      if (len > 0) {
        items.push({ type: 'deletion', refPosition: refPos, length: len })
        refPos += len
      }
    } else if (ch === '+') {
      i++
      const seqStart = i
      while (i < cs.length && !isCsOpChar(cs[i])) {
        i++
      }
      const len = i - seqStart
      if (len > 0) {
        items.push({
          type: 'insertion',
          refPosition: refPos,
          length: len,
          insertionSeq: cs.slice(seqStart, seqStart + len).toUpperCase(),
        })
      }
    } else {
      i++
    }
  }
  return items
}

export function buildSyntenyIndex(
  genomeRows: Map<string, MultiPairFeature[]>,
  displayedGenomes: string[],
  showSnps: boolean,
) {
  let totalFeatures = 0
  for (let g = 0; g < displayedGenomes.length; g++) {
    const feats = genomeRows.get(displayedGenomes[g]!)
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

      if (showSnps) {
        let items: CigarHitResult[] | undefined
        if (feat.cs) {
          items = collectCsItems(feat.cs, feat.start)
        } else if (feat.cigar) {
          items = collectCigarItems(parseCigar2(feat.cigar), feat.start)
        }
        if (items) {
          for (const item of items) {
            cigarEntries.push({ featureIdx: featIdx, sampleIdx: g, item })
          }
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

  return { featureFb, features, genomeNames, cigarFb, cigarEntries } satisfies SyntenyFlatbushIndex
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
  const bp = view.pxToBp(mouseX - labelW)
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
