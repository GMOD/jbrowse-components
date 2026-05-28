import { parseSvAlt } from '@jbrowse/sv-core'
import { assembleLocString } from '@jbrowse/core/util'

import type { Feature } from '@jbrowse/core/util'

const SV_SYMBOLIC_ALLELES = ['<TRA', '<DEL', '<INV', '<INS', '<DUP', '<CNV']

export function makeFeaturePair(feature: Feature, alt?: string) {
  const start = feature.get('start') as number
  let end = feature.get('end') as number
  const strand = feature.get('strand') as number
  const mate = feature.get('mate') as
    | {
        refName: string
        start: number
        end: number
        mateDirection?: number
      }
    | undefined
  const refName = feature.get('refName') as string

  let mateRefName: string | undefined
  let mateEnd = 0
  let mateStart = 0
  let mateDirection = 0
  let joinDirection = 0

  const parsed = parseSvAlt(feature, alt)
  if (parsed) {
    mateRefName = parsed.mateRefName
    mateEnd = parsed.matePos
    mateStart = parsed.matePos - 1
    mateDirection = parsed.mateDirection ?? 0
    joinDirection = parsed.joinDirection ?? 0
    if (alt && SV_SYMBOLIC_ALLELES.some(a => alt.startsWith(a))) {
      // re-adjust the arc to be from start to end of feature by re-assigning
      // end to the 'mate'
      end = start + 1
    }
  }

  return {
    k1: {
      refName,
      start,
      end,
      strand,
      mateDirection,
    },
    k2: mate ?? {
      refName: mateRefName ?? 'unknown',
      end: mateEnd,
      start: mateStart,
      mateDirection: joinDirection,
    },
  }
}

export function makeSummary(feature: Feature, alt?: string) {
  const { k1, k2 } = makeFeaturePair(feature, alt)
  return [
    feature.get('name'),
    feature.get('id'),
    assembleLocString(k1),
    assembleLocString(k2),
    feature.get('INFO')?.SVTYPE,
    alt,
  ]
    .filter(Boolean)
    .join('<br/>')
}
