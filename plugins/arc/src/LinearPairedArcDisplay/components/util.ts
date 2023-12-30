import { Feature, assembleLocString } from '@jbrowse/core/util'
import { parseBreakend } from '@gmod/vcf'

export function makeFeaturePair(feature: Feature, alt?: string) {
  const bnd = alt ? parseBreakend(alt) : undefined
  let start = feature.get('start')
  let end = feature.get('end')
  const strand = feature.get('strand')
  const mate = feature.get('mate')
  const refName = feature.get('refName')

  let mateRefName: string | undefined
  let mateEnd = 0
  let mateStart = 0

  // one sided bracket used, because there could be <INS:ME> and we just check
  // startswith below
  const symbolicAlleles = ['<TRA', '<DEL', '<INV', '<INS', '<DUP', '<CNV']
  if (symbolicAlleles.some(a => alt?.startsWith(a))) {
    // END is defined to be a single value, not an array. CHR2 not defined in
    // VCF spec, but should be similar
    const e = feature.get('INFO')?.END?.[0] || feature.get('end')
    mateEnd = e
    mateStart = e - 1
    mateRefName = feature.get('INFO')?.CHR2?.[0] ?? refName
    // re-adjust the arc to be from start to end of feature by re-assigning end
    // to the 'mate'
    start = feature.get('start')
    end = feature.get('start') + 1
  } else if (bnd?.MatePosition) {
    const matePosition = bnd.MatePosition.split(':')
    mateEnd = +matePosition[1]
    mateStart = +matePosition[1] - 1
    mateRefName = matePosition[0]
  }

  return {
    k1: { refName, start, end, strand },
    k2: mate ?? { refName: mateRefName, end: mateEnd, start: mateStart },
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
