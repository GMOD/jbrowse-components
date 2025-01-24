import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import { featureSpanPx, renderToAbstractCanvas } from '@jbrowse/core/util'

// locals
import { getCol } from '../util'

import type { Source } from '../types'
import type { RenderArgsDeserialized as FeatureRenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import type { Feature } from '@jbrowse/core/util'
import type { ThemeOptions } from '@mui/material'

export interface RenderArgsDeserialized extends FeatureRenderArgsDeserialized {
  bpPerPx: number
  height: number
  highResolutionScaling: number
  themeOptions: ThemeOptions
}

export interface RenderArgsDeserializedWithFeatures
  extends RenderArgsDeserialized {
  features: Map<string, Feature>
}

export interface MultiRenderArgsDeserialized
  extends RenderArgsDeserializedWithFeatures {
  sources: Source[]
  rowHeight: number
  scrollTop: number
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
    const { scrollTop, sources, rowHeight, features, regions, bpPerPx } = props
    const region = regions[0]!

    for (const feature of features.values()) {
      if (feature.get('end') - feature.get('start') <= 10) {
        const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
        const w = Math.max(Math.round(rightPx - leftPx), 2)
        const genotypes = feature.get('genotypes') as Record<string, string>
        let t = -scrollTop
        for (const { name } of sources) {
          ctx.fillStyle = getCol(genotypes[name]!)
          ctx.fillRect(Math.floor(leftPx), t, w, Math.max(t + rowHeight, 1))
          t += rowHeight
        }
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
