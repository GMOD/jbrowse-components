import { set1 } from '@jbrowse/core/ui/colors'
import { colord } from '@jbrowse/core/util/colord'

import { colorify } from '../util'

export function getColorAlleleCount(alleles: string[]) {
  const total = alleles.length
  let alt = 0
  let uncalled = 0
  let alt2 = 0
  let ref = 0
  for (const allele of alleles) {
    if (allele === '1') {
      alt++
    } else if (allele === '0') {
      ref++
    } else if (allele === '.') {
      uncalled++
    } else {
      alt2++
    }
  }

  if (ref === total) {
    return `#ccc`
  } else {
    let a1 = colord(`hsl(200,50%,${80 - (alt / total) * 50}%)`)
    if (alt2) {
      // @ts-ignore
      a1 = a1.mix(`hsla(0,100%,20%,${alt2 / total})`)
    }
    if (uncalled) {
      // @ts-ignore
      a1 = a1.mix(`hsla(50,50%,50%,${uncalled / total / 2})`)
    }
    return a1.toHex()
  }
}

export function getColorPhased(alleles: string[], HP: number) {
  const c = +alleles[HP]!
  return c ? set1[c - 1] || 'black' : '#ccc'
}

export function getColorPhasedWithPhaseSet(
  alleles: string[],
  HP: number,
  PS: string,
) {
  const c = +alleles[HP]!
  return c ? colorify(+PS) || 'black' : '#ccc'
}
