import { sum } from '@jbrowse/core/util'

import { set1 } from '@jbrowse/core/ui/colors'

import type { RenderArgsDeserializedWithFeaturesAndLayout } from './types'
import type { Source } from '../types'
import type { Feature } from '@jbrowse/core/util'

const fudgeFactor = 0.6
const f2 = fudgeFactor / 2
const splitter = /[/|]/

// used for calculating minor allele
function findSecondLargest(arr: Iterable<number>) {
  let firstMax = -Infinity
  let secondMax = -Infinity

  for (const num of arr) {
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
      const alleles = genotype.split(':')[0]?.split(splitter)
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

function drawUnphased(
  alleles: string[],
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
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

  if (alt) {
    ctx.fillStyle = `hsl(200,50%,${80 - (alt / total) * 50}%)`
    ctx.fillRect(x - f2, y - f2, w + f2, h + f2)
  }
  if (ref === total) {
    ctx.fillStyle = `#ccc`
    ctx.fillRect(x - f2, y - f2, w + f2, h + f2)
  }
  if (alt2) {
    ctx.fillStyle = `hsla(0,50%,50%,${alt2 / total / 2})`
    ctx.fillRect(x - f2, y - f2, w + f2, h + f2)
  }
  if (uncalled) {
    ctx.fillStyle = `hsla(50,50%,50%,${uncalled / total / 2})`
    ctx.fillRect(x - f2, y - f2, w + f2, h + f2)
  }
}
function drawPhased(
  alleles: string[],
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  let l = alleles.length
  let offset = 0
  for (let k = 0; k < l; k++) {
    const c = +alleles[k]!
    ctx.fillStyle = c ? set1[c - 1] || 'black' : '#ccc'
    ctx.fillRect(x - f2, y - f2 + offset, w + f2, h / l + f2)
    offset += h / l
  }
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
  const { phasedMode, minorAlleleFrequencyFilter, sources, features } =
    renderArgs
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

  const m = mafs.length
  const w = canvasWidth / m
  let samplePloidy = {} as Record<string, number>
  let hasPhased = false
  for (let i = 0; i < m; i++) {
    const f = mafs[i]!
    const samp = f.get('genotypes') as Record<string, string>
    const x = (i / mafs.length) * canvasWidth
    const s = sources.length
    for (let j = 0; j < s; j++) {
      const y = (j / s) * canvasHeight
      const { name } = sources[j]!
      const genotype = samp[name]!
      const isPhased = genotype.includes('|')
      hasPhased ||= isPhased
      if (phasedMode === 'phasedOnly') {
        if (isPhased) {
          const alleles = genotype.split('|') || ''
          samplePloidy[name] = alleles.length
          hasPhased = true
          drawPhased(alleles, ctx, x, y, w, h)
        } else {
          ctx.fillStyle = `#CBC3E3`
          ctx.fillRect(x - f2, y - f2, w + f2, h + f2)
        }
      } else if (phasedMode === 'both') {
        if (isPhased) {
          const alleles = genotype.split('|') || ''
          samplePloidy[name] = alleles.length
          hasPhased = true
          drawPhased(alleles, ctx, x, y, w, h)
        } else {
          const alleles = genotype.split('/') || ''
          drawUnphased(alleles, ctx, x, y, w, h)
        }
      } else {
        const alleles = genotype.split(/[/|]/) || ''
        drawUnphased(alleles, ctx, x, y, w, h)
      }
    }
  }
  return {
    samplePloidy,
    hasPhased,
    mafs,
  }
}
