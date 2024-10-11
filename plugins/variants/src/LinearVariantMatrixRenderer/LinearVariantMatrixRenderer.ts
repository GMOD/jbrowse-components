import BoxRendererType, {
  RenderArgs,
  RenderArgsSerialized,
  RenderArgsDeserialized as BoxRenderArgsDeserialized,
  RenderResults,
  ResultsSerialized,
  ResultsDeserialized,
} from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import { Feature, renderToAbstractCanvas } from '@jbrowse/core/util'

export interface SortParams {
  type: string
  pos: number
  refName: string
  assemblyName: string
  tag?: string
}

export interface RenderArgsDeserialized extends BoxRenderArgsDeserialized {
  highResolutionScaling: number
  height: number
}

export interface RenderArgsDeserializedWithFeaturesAndLayout
  extends RenderArgsDeserialized {
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
    const { features } = renderArgs
    const feats = [...features.values()]
    if (!feats.length) {
      return
    }
    const samples = feats[0].get('samples')
    const keys = Object.keys(samples)
    const h = canvasHeight / keys.length

    const mafs = [] as number[]
    for (let i = 0; i < feats.length; i++) {
      let c = 0
      let c2 = 0
      for (let j = 0; j < keys.length; j++) {
        const key = keys[j]
        const samp = feats[i].get('samples')
        const s = samp[key].GT[0]
        if (s === '0|0') {
        } else if (s === '1|0' || s === '0|1') {
          c++
        } else if (s === '1|1') {
          c++
          c2++
        } else {
          c++
        }
      }
      if (c / keys.length > 0.15 && c2 / keys.length < 0.85) {
        mafs.push(i)
      }
    }

    const w = canvasWidth / mafs.length
    for (let i = 0; i < mafs.length; i++) {
      const m = mafs[i]
      const f = feats[m]
      const x = (i / mafs.length) * canvasWidth
      for (let j = 0; j < keys.length; j++) {
        const y = (j / keys.length) * canvasHeight
        const key = keys[j]
        const samp = f.get('samples')
        const s = samp[key].GT[0]
        if (s === '0|0') {
          ctx.fillStyle = 'grey'
        } else if (s === '1|0' || s === '0|1') {
          ctx.fillStyle = 'teal'
        } else if (s === '1|1') {
          ctx.fillStyle = 'blue'
        } else {
          ctx.fillStyle = 'purple'
        }
        ctx.fillRect(x - f2, y - f2, w + f2, h + f2)
      }
    }
    return { samples: Object.keys(samples) }
  }

  async render(renderProps: RenderArgsDeserialized) {
    const features = await this.getFeatures(renderProps)
    const { height, regions, bpPerPx } = renderProps
    const [region] = regions

    const { end, start } = region

    const width = (end - start) / bpPerPx
    const res = await renderToAbstractCanvas(width, height, renderProps, ctx =>
      this.makeImageData({
        ctx,
        canvasWidth: width,
        canvasHeight: height,
        renderArgs: {
          ...renderProps,
          features,
        },
      }),
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
      height,
      width,
    }
  }
}

export type {
  RenderArgs,
  RenderArgsSerialized,
  RenderResults,
  ResultsSerialized,
  ResultsDeserialized,
}
