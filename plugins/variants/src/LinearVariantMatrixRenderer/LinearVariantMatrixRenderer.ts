import BoxRendererType from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import { SimpleFeature, renderToAbstractCanvas } from '@jbrowse/core/util'

import { getCol } from '../util'

import type { Source } from '../util'
import type { RenderArgsDeserialized as BoxRenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import type { Feature } from '@jbrowse/core/util'

export interface SortParams {
  type: string
  pos: number
  refName: string
  assemblyName: string
  tag?: string
}

export interface RenderArgsDeserialized extends BoxRenderArgsDeserialized {
  sources: { name: string }[]
  highResolutionScaling: number
  height: number
}

export interface RenderArgsDeserializedWithFeaturesAndLayout
  extends RenderArgsDeserialized {
  sources: Source[]
  features: Map<string, Feature>
}

const fudgeFactor = 0.6
const f2 = fudgeFactor / 2

export default class LinearVariantMatrixRenderer extends BoxRendererType {
  supportsSVG = true

  makeImageData({
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
    const { sources, features } = renderArgs
    const feats = [...features.values()]
    const h = canvasHeight / sources.length
    const mafs = [] as Feature[]
    for (const feat of feats) {
      let c = 0
      let c2 = 0
      const samp = feat.get('genotypes')
      for (const { name } of sources) {
        const s = samp[name]!
        if (s === '0|0') {
          /* do nothing */
        } else if (s === '1|0' || s === '0|1') {
          c++
        } else if (s === '1|1') {
          c++
          c2++
        } else {
          c++
        }
      }
      if (c / sources.length > 0.15 && c2 / sources.length < 0.85) {
        mafs.push(feat)
      }
    }

    const w = canvasWidth / mafs.length
    const vals = ['0|0', '0|1', '1|0', '1|1']
    for (const val of vals) {
      ctx.beginPath()
      ctx.fillStyle = getCol(val)
      for (let i = 0; i < mafs.length; i++) {
        const f = mafs[i]!
        const samp = f.get('genotypes')
        const x = (i / mafs.length) * canvasWidth
        for (let j = 0; j < sources.length; j++) {
          const y = (j / sources.length) * canvasHeight
          const { name } = sources[j]!
          if (samp[name] === val) {
            ctx.rect(x - f2, y - f2, w + f2, h + f2)
          }
        }
      }
      ctx.fill()
    }
    return { mafs }
  }

  async render(renderProps: RenderArgsDeserialized) {
    const features = await this.getFeatures(renderProps)
    const { height, sources, regions, bpPerPx } = renderProps
    const region = regions[0]!
    const { end, start } = region

    const width = (end - start) / bpPerPx
    // @ts-expect-error
    const { mafs, ...res } = await renderToAbstractCanvas(
      width,
      height,
      renderProps,
      ctx => {
        return this.makeImageData({
          ctx,
          canvasWidth: width,
          canvasHeight: height,
          renderArgs: {
            ...renderProps,
            features,
            sources,
          },
        })
      },
    )

    const results = await super.render({
      ...renderProps,
      ...res,
      features,
      height,
      width,
    })

    return {
      ...results,
      ...res,
      features: new Map(),
      simplifiedFeatures: mafs.map(
        (s: Feature) =>
          new SimpleFeature({
            id: s.id(),
            data: {
              start: s.get('start'),
              end: s.get('end'),
              refName: s.get('refName'),
            },
          }),
      ),
      height,
      width,
    }
  }
}

export type {
  RenderArgs,
  RenderArgsSerialized,
  RenderResults,
  ResultsDeserialized,
  ResultsSerialized,
} from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
