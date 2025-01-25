import { sum } from '@jbrowse/core/util'

import type { Source } from './types'
import type { Feature } from '@jbrowse/core/util'

// avoid drawing negative width features for SVG exports
export function fillRectCtx(
  x: number,
  y: number,
  width: number,
  height: number,
  ctx: CanvasRenderingContext2D,
  color?: string,
) {
  if (width < 0) {
    x += width
    width = -width
  }
  if (height < 0) {
    y += height
    height = -height
  }

  if (color) {
    ctx.fillStyle = color
  }
  ctx.fillRect(x, y, width, height)
}

export function getCol(gt: string) {
  if (gt === '0|0' || gt === '0/0') {
    return '#ccc'
  } else if (gt === '1|0' || gt === '0|1' || gt === '0/1' || gt === '1/0') {
    return 'teal'
  } else if (gt === '1|1' || gt === '1/1') {
    return 'blue'
  } else {
    return '#CBC3E3'
  }
}

export function randomColor(str: string) {
  let sum = 0

  for (let i = 0; i < str.length; i++) {
    sum += str.charCodeAt(i)
  }
  return `hsl(${sum * 10}, 20%, 50%)`
}

// used for calculating minor allele
export function findSecondLargest(arr: Iterable<number>) {
  let firstMax = 0
  let secondMax = 0

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

export function calculateMinorAlleleFrequency(feat: Feature) {
  // only draw smallish indels, unclear how to draw large structural variants
  // even though they are important
  if (feat.get('end') - feat.get('start') <= 10) {
    const samp = feat.get('genotypes') as Record<string, string>
    const alleleCounts = new Map()
    for (const val of Object.values(samp)) {
      const alleles = val.split(/[/|]/)
      for (const allele of alleles) {
        alleleCounts.set(allele, (alleleCounts.get(allele) || 0) + 1)
      }
    }

    return (
      findSecondLargest(alleleCounts.values()) /
      (sum(alleleCounts.values()) || 1)
    )
  }
  return -1
}

export function getFeaturesThatPassMinorAlleleFrequencyFilter(
  feats: Iterable<Feature>,
  minorAlleleFrequencyFilter: number,
) {
  const mafs = [] as Feature[]
  for (const feat of feats) {
    if (calculateMinorAlleleFrequency(feat) > minorAlleleFrequencyFilter) {
      mafs.push(feat)
    }
  }
  return mafs
}
