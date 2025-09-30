import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import { renderToAbstractCanvas, updateStatus } from '@jbrowse/core/util'

import { getNiceDomain } from './util'

import type { ScaleOpts, Source } from './util'
import type {
  RenderArgs as FeatureRenderArgs,
  RenderArgsDeserialized as FeatureRenderArgsDeserialized,
} from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import type { Feature } from '@jbrowse/core/util'
import type { ThemeOptions } from '@mui/material'

export interface RenderArgs extends FeatureRenderArgs {
  scaleOpts: ScaleOpts
}

export interface RenderArgsDeserialized extends FeatureRenderArgsDeserialized {
  bpPerPx: number
  height: number
  highResolutionScaling: number
  scaleOpts: ScaleOpts
  displayCrossHatches: boolean
  ticks: { values: number[] }
  inverted: boolean
  themeOptions: ThemeOptions
  statusCallback?: (arg: string) => void
}

export interface RenderArgsDeserializedWithFeatures
  extends RenderArgsDeserialized {
  features: Map<string, Feature>
  inverted: boolean
}

export interface MultiRenderArgsDeserialized
  extends RenderArgsDeserializedWithFeatures {
  sources: Source[]
}

export default abstract class WiggleBaseRenderer extends FeatureRendererType {
  supportsSVG = true

  async render(renderProps: RenderArgsDeserialized) {
    const features = await this.getFeatures(renderProps)
    const { inverted, height, regions, bpPerPx, scaleOpts, statusCallback } =
      renderProps

    const region = regions[0]!
    const width = (region.end - region.start) / bpPerPx

    // calculate new domain for single region views
    let newDomain: number[] | undefined
    if (regions.length === 1) {
      let scoreMin = Infinity
      let scoreMax = -Infinity
      for (const feature of features.values()) {
        const score = feature.get('score') as number
        scoreMin = Math.min(scoreMin, score)
        scoreMax = Math.max(scoreMax, score)
      }
      if (scoreMin !== Infinity) {
        const { scaleType, minScore, maxScore } = scaleOpts
        newDomain = getNiceDomain({
          domain: [scoreMin, scoreMax],
          bounds: [minScore, maxScore],
          scaleType: scaleType,
        })
      }
    }

    const newScaleOpts = { ...scaleOpts, domain: newDomain || scaleOpts.domain }

    const { reducedFeatures, ...rest } = await updateStatus(
      'Rendering plot',
      statusCallback || (() => {}),
      () =>
        renderToAbstractCanvas(
          width,
          height,
          renderProps,
          ctx =>
            this.draw(ctx, {
              ...renderProps,
              scaleOpts: newScaleOpts,
              features,
              inverted,
            }) as Promise<{ reducedFeatures: Feature[] | undefined }>,
        ),
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
      features: reducedFeatures
        ? new Map<string, Feature>(reducedFeatures.map(r => [r.id(), r]))
        : results.features,
      height,
      width,
      containsNoTransferables: true,
    }
  }

  /**
   * draw features to context given props, to be used by derived renderer
   * classes
   */
  abstract draw<T extends RenderArgsDeserializedWithFeatures>(
    ctx: CanvasRenderingContext2D,
    props: T,
  ): Promise<Record<string, unknown> | undefined>
}

export type {
  RenderArgsSerialized,
  RenderResults,
  ResultsDeserialized,
  ResultsSerialized,
} from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
