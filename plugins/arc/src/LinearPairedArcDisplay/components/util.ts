import { parseBreakend } from '@gmod/vcf'
import { assembleLocString } from '@jbrowse/core/util'
import type { Feature } from '@jbrowse/core/util'

export function makeFeaturePair(feature: Feature, alt?: string) {
  const bnd = alt ? parseBreakend(alt) : undefined
  const start = feature.get('start')
  let end = feature.get('end')
  const strand = feature.get('strand')
  const mate = feature.get('mate') as
    | {
        refName: string
        start: number
        end: number
        mateDirection?: number
      }
    | undefined
  const refName = feature.get('refName')

  let mateRefName: string | undefined
  let mateEnd = 0
  let mateStart = 0
  let joinDirection = 0
  let mateDirection = 0

  // one sided bracket used, because there could be <INS:ME> and we just check
  // startswith below
  const symbolicAlleles = ['<TRA', '<DEL', '<INV', '<INS', '<DUP', '<CNV']
  if (symbolicAlleles.some(a => alt?.startsWith(a))) {
    // END is defined to be a single value, not an array. CHR2 not defined in
    // VCF spec, but should be similar
    const info = feature.get('INFO')
    const e = info?.END?.[0] ?? end
    mateRefName = info?.CHR2?.[0] ?? refName
    mateEnd = e
    mateStart = e - 1
    // re-adjust the arc to be from start to end of feature by re-assigning end
    // to the 'mate'
    end = start + 1
  } else if (bnd?.MatePosition) {
    const matePosition = bnd.MatePosition.split(':')
    mateDirection = bnd.MateDirection === 'left' ? 1 : -1
    joinDirection = bnd.Join === 'left' ? -1 : 1
    mateEnd = +matePosition[1]!
    mateStart = +matePosition[1]! - 1
    mateRefName = matePosition[0]
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
      refName: mateRefName || 'unknown',
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
    .filter(f => !!f)
    .join(' - ')
}
