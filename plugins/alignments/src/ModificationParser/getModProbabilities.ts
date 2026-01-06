import { getTagAlt } from '../util.ts'

import type { Feature } from '@jbrowse/core/util'

export function getModProbabilities(feature: Feature) {
  // ML stores probabilities as array of numerics and MP is scaled phred scores
  // https://github.com/samtools/hts-specs/pull/418/files#diff-e765c6479316309f56b636f88189cdde8c40b854c7bdcce9ee7fe87a4e76febcR596
  //
  // - if we have ML or Ml, it is an 8bit probability, divide by 255
  //
  // - if we have MP or Mp it is phred scaled ASCII, which can go up to 90 but
  // has very high likelihood basecalls at that point, we really only care about
  // low qual calls <20 approx
  const m = (getTagAlt(feature, 'ML', 'Ml') as number[] | string) || []
  if (m) {
    const result = []
    if (typeof m === 'string') {
      const parts = m.split(',')
      for (let i = 0, l = parts.length; i < l; i++) {
        result.push(+parts[i]! / 255)
      }
    } else {
      for (let i = 0, l = m.length; i < l; i++) {
        result.push(m[i]! / 255)
      }
    }
    return result
  } else {
    const mp = getTagAlt(feature, 'MP', 'Mp') as string | undefined
    if (mp) {
      const result = []
      for (let i = 0, l = mp.length; i < l; i++) {
        const phred = mp.charCodeAt(i) - 33
        result.push(Math.min(1, phred / 50))
      }
      return result
    }
    return undefined
  }
}
