import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import { featureSpanPx, renderToAbstractCanvas } from '@jbrowse/core/util'

import { getCol, getFeaturesThatPassMinorAlleleFrequencyFilter } from '../util'

import type { Feature } from '@jbrowse/core/util'
import type { MultiRenderArgsDeserialized } from './types'
import {
  getColorAlleleCount,
  getColorPhased,
} from '../shared/multiVariantColor'

const fudgeFactor = 0.6
const f2 = fudgeFactor / 2

function drawColorAlleleCount(
  alleles: string[],
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.fillStyle = getColorAlleleCount(alleles)
  ctx.fillRect(x - f2, y - f2, w + f2, h + f2)
}

function drawPhased(
  alleles: string[],
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  HP: number,
) {
  ctx.fillStyle = getColorPhased(alleles, HP)
  ctx.fillRect(x - f2, y - f2, w + f2, h + f2)
}
export default class MultiVariantBaseRenderer extends FeatureRendererType {
  supportsSVG = true

  async render(renderProps: MultiRenderArgsDeserialized) {
    const features = await this.getFeatures(renderProps)
    const { height, regions, bpPerPx } = renderProps
    const region = regions[0]!
    const width = (region.end - region.start) / bpPerPx

    const rest = await renderToAbstractCanvas(
      width,
      height,
      renderProps,
      async ctx => {
        await this.draw(ctx, {
          ...renderProps,
          features,
        })
        return undefined
      },
    )

    const results = await super.render({
      ...renderProps,
      ...rest,
      features,
      height,
      width,
    })

    return {
      ...results,
      ...rest,
      features: new Map<string, Feature>(),
      height,
      width,
      containsNoTransferables: true,
    }
  }
  async draw(
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
    } = props
    const region = regions[0]!
    const mafs = getFeaturesThatPassMinorAlleleFrequencyFilter(
      features.values(),
      minorAlleleFrequencyFilter,
    )
    for (const feature of features.values()) {
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
      const w = Math.max(Math.round(rightPx - leftPx), 2)
      const samp = feature.get('genotypes') as Record<string, string>
      let t = -scrollTop

      const s = sources.length
      for (let j = 0; j < s; j++) {
        const { name, HP } = sources[j]!
        const genotype = samp[name]
        const x = Math.floor(leftPx)
        const y = t
        const h = Math.max(rowHeight, 1)
        if (genotype) {
          const isPhased = genotype.includes('|')
          if (renderingMode === 'phased') {
            if (isPhased) {
              const alleles = genotype.split('|')
              drawPhased(alleles, ctx, x, y, w, h, HP!)
            } else {
              ctx.fillStyle = 'black'
              ctx.fillRect(x - f2, y - f2, w + f2, h + f2)
            }
          } else {
            const alleles = genotype.split(/[/|]/)
            drawColorAlleleCount(alleles, ctx, x, y, w, h)
          }
        }
        t += rowHeight
      }
    }
  }
}

export type {
  RenderArgsSerialized,
  RenderResults,
  ResultsDeserialized,
  ResultsSerialized,
} from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
