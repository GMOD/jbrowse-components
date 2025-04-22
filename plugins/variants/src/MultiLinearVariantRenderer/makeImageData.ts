import { featureSpanPx, forEachWithStopTokenCheck } from '@jbrowse/core/util'
import { checkStopToken } from '@jbrowse/core/util/stopToken'
import RBush from 'rbush'

import { f2 } from '../shared/constants'
import { drawColorAlleleCount } from '../shared/drawAlleleCount'
import { drawPhased } from '../shared/drawPhased'
import { getFeaturesThatPassMinorAlleleFrequencyFilter } from '../shared/minorAlleleFrequencyUtils'

import type { MultiRenderArgsDeserialized } from './types'

export async function makeImageData(
  ctx: CanvasRenderingContext2D,
  props: MultiRenderArgsDeserialized,
) {
  const {
    scrollTop,
    minorAlleleFrequencyFilter,
    sources,
    rowHeight,
    features,
    regions,
    bpPerPx,
    renderingMode,
    stopToken,
    lengthCutoffFilter,
    referenceDrawingMode,
  } = props
  const region = regions[0]!

  checkStopToken(stopToken)
  const mafs = getFeaturesThatPassMinorAlleleFrequencyFilter({
    stopToken,
    features: features.values(),
    minorAlleleFrequencyFilter,
    lengthCutoffFilter,
  })
  checkStopToken(stopToken)
  const rbush = new RBush()

  forEachWithStopTokenCheck(mafs, stopToken, ({ mostFrequentAlt, feature }) => {
    const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
    const w = Math.max(Math.round(rightPx - leftPx), 2)
    const samp = feature.get('genotypes') as Record<string, string>
    let y = -scrollTop

    const s = sources.length
    if (renderingMode === 'phased') {
      for (let j = 0; j < s; j++) {
        const { name, HP } = sources[j]!
        const genotype = samp[name]
        const x = Math.floor(leftPx)
        const h = Math.max(rowHeight, 1)
        if (genotype) {
          const isPhased = genotype.includes('|')
          if (isPhased) {
            const alleles = genotype.split('|')
            if (
              drawPhased(
                alleles,
                ctx,
                x,
                y,
                w,
                h,
                HP!,
                undefined,
                referenceDrawingMode === 'draw',
              )
            ) {
              rbush.insert({
                minX: x,
                maxX: x + w,
                minY: y,
                maxY: y + h,
                genotype,
                name,
                featureId: feature.id(),
              })
            }
          } else {
            ctx.fillStyle = 'black'
            ctx.fillRect(x - f2, y - f2, w + f2, h + f2)
          }
        }
        y += rowHeight
      }
    } else {
      const cacheSplit = {} as Record<
        string,
        {
          alt: number
          ref: number
          uncalled: number
          alt2: number
          total: number
        }
      >
      for (let j = 0; j < s; j++) {
        const { name } = sources[j]!
        const genotype = samp[name]
        const x = Math.floor(leftPx)
        const h = Math.max(rowHeight, 1)
        if (genotype) {
          let alleles: string[]
          let alt = 0
          let uncalled = 0
          let alt2 = 0
          let ref = 0
          let total = 0
          if (cacheSplit[genotype]) {
            const r = cacheSplit[genotype]
            alt = r.alt
            ref = r.ref
            uncalled = r.uncalled
            alt2 = r.alt2
            total = r.total
          } else {
            alleles = genotype.split(/[/|]/)
            total = alleles.length

            for (let i = 0; i < total; i++) {
              const allele = alleles[i]!
              if (allele === mostFrequentAlt) {
                alt++
              } else if (allele === '0') {
                ref++
              } else if (allele === '.') {
                uncalled++
              } else {
                alt2++
              }
            }
            cacheSplit[genotype] = { alt, ref, uncalled, alt2, total }
          }
          if (
            drawColorAlleleCount(
              ref,
              alt,
              alt2,
              uncalled,
              total,
              ctx,
              x,
              y,
              w,
              h,
              referenceDrawingMode === 'draw',
              feature.get('type'),
              feature.get('strand'),
              0.75,
            )
          ) {
            rbush.insert({
              minX: x,
              maxX: x + w,
              minY: y,
              maxY: y + h,
              genotype,
              name,
              featureId: feature.id(),
            })
          }
        }
        y += rowHeight
      }
    }
  })

  return {
    rbush: rbush.toJSON(),
    featureGenotypeMap: Object.fromEntries(
      mafs.map(({ feature }) => [
        feature.id(),
        {
          alt: feature.get('ALT'),
          ref: feature.get('REF'),
          name: feature.get('name'),
          description: feature.get('description'),
          length: feature.get('end') - feature.get('start'),
        },
      ]),
    ),
  }
}
