import { getCol } from '../util'

import { sum } from '@jbrowse/core/util'
import { colord } from '@jbrowse/core/util/colord'

import type { Feature } from '@jbrowse/core/util'
import type { RenderArgsDeserializedWithFeaturesAndLayout } from './types'
import type { Source } from '../types'

const fudgeFactor = 0.6
const f2 = fudgeFactor / 2

function findSecondLargest(arr: Iterable<number>) {
  let firstMax = -Infinity
  let secondMax = -Infinity

  for (let num of arr) {
    if (num > firstMax) {
      secondMax = firstMax
      firstMax = num
    } else if (num > secondMax && num !== firstMax) {
      secondMax = num
    }
  }

  return secondMax
}

function calculateMinorAlleleFrequency(feat: Feature, sources: Source[]) {
  // only draw smallish indels, unclear how to draw large structural variants
  // even though they are important
  if (feat.get('end') - feat.get('start') <= 10) {
    const samp = feat.get('genotypes') as Record<string, string>
    const alleleCounts = new Map()
    for (const { name } of sources) {
      const genotype = samp[name]!
      const alleles = genotype.split(':')[0]?.split(/[\/\|]/)
      if (alleles) {
        for (const allele of alleles) {
          alleleCounts.set(allele, (alleleCounts.get(allele) || 0) + 1)
        }
      }
    }

    return findSecondLargest(alleleCounts.values()) / sum(alleleCounts.values())
  }
  return -1
}

export function makeImageData({
  ctx,
  canvasWidth,
  canvasHeight,
  renderArgs,
}: {
  ctx: CanvasRenderingContext2D
  canvasWidth: number
  canvasHeight: number
  renderArgs: RenderArgsDeserializedWithFeaturesAndLayout
}) {
  const { minorAlleleFrequencyFilter, sources, features } = renderArgs
  const feats = [...features.values()]
  const h = canvasHeight / sources.length
  const mafs = [] as Feature[]
  for (const feat of feats) {
    if (
      calculateMinorAlleleFrequency(feat, sources) >= minorAlleleFrequencyFilter
    ) {
      mafs.push(feat)
    }
  }

  const w = canvasWidth / mafs.length
  for (let i = 0; i < mafs.length; i++) {
    const f = mafs[i]!

    // only draw smallish indels
    const samp = f.get('genotypes') as Record<string, string>
    const x = (i / mafs.length) * canvasWidth
    for (let j = 0; j < sources.length; j++) {
      const y = (j / sources.length) * canvasHeight
      const { name } = sources[j]!
      const alleles = samp[name]!.split(':')[0]?.split(/[\/\|]/) || ''
      const total = alleles.length
      let alt = 0
      let uncalled = 0
      let alt2 = 0
      for (const allele of alleles) {
        if (allele === '1') {
          alt++
        } else if (allele === '.') {
          uncalled++
        } else {
          alt2++
        }
      }

      if (alleles.length === 2) {
        ctx.fillStyle = getCol(samp[name]!)
        ctx.fillRect(x - f2, y - f2, w + f2, h + f2)
      } else {
        if (alt) {
          ctx.fillStyle = `hsl(200,50%,${alt / total})`
          ctx.fillRect(x - f2, y - f2, w + f2, h + f2)
        }
        if (alt2) {
          ctx.fillStyle = `hsla(0,50%,50%,${alt2 / total})`
          ctx.fillRect(x - f2, y - f2, w + f2, h + f2)
        }
        if (uncalled) {
          ctx.fillStyle = `hsla(150,50%,50%,${uncalled / total})`
          ctx.fillRect(x - f2, y - f2, w + f2, h + f2)
        }
      }
    }
  }
  return { mafs }
}
