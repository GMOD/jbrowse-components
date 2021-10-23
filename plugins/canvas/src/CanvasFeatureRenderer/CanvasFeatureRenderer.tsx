import BoxRendererType, {
  RenderArgs,
  RenderArgsSerialized,
  RenderArgsDeserialized as BoxRenderArgsDeserialized,
  RenderResults,
  ResultsSerialized,
  ResultsDeserialized,
} from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { BaseLayout } from '@jbrowse/core/util/layouts/BaseLayout'
import { iterMap, bpSpanPx } from '@jbrowse/core/util'
import { renderToAbstractCanvas } from '@jbrowse/core/util/offscreenCanvasUtils'
import BoxGlyph from './FeatureGlyphs/Box'
import GeneGlyph from './FeatureGlyphs/Gene'
import { LaidOutFeatureRect } from './FeatureGlyph'

export type {
  RenderArgs,
  RenderArgsSerialized,
  RenderResults,
  ResultsSerialized,
  ResultsDeserialized,
}

export interface RenderArgsDeserialized extends BoxRenderArgsDeserialized {
  highResolutionScaling: number
}

export interface RenderArgsDeserializedWithFeaturesAndLayout
  extends RenderArgsDeserialized {
  features: Map<string, Feature>
  layout: BaseLayout<Feature>
  regionSequence?: string
  width: number
  height: number
}

export default class CanvasRenderer extends BoxRendererType {
  supportsSVG = true

  layoutFeature(
    feature: Feature,
    layout: BaseLayout<Feature>,
    props: RenderArgsDeserialized,
  ): LaidOutFeatureRect | null {
    const glyph = new BoxGlyph()
    const geneglyph = new GeneGlyph()
    const [region] = props.regions
    if (feature.get('type') === 'gene') {
      return geneglyph.layoutFeature({ region, ...props }, layout, feature)
    } else {
      return glyph.layoutFeature({ region, ...props }, layout, feature)
    }
  }

  drawRect(
    ctx: CanvasRenderingContext2D,
    fRect: LaidOutFeatureRect,
    props: RenderArgsDeserialized,
  ) {
    const { regions } = props
    const [region] = regions

    const glyph = new BoxGlyph()
    const geneglyph = new GeneGlyph()

    if (fRect.f.get('type') === 'gene') {
      geneglyph.renderFeature(ctx, { ...props, region }, fRect)
    } else {
      glyph.renderFeature(ctx, { ...props, region }, fRect)
    }
  }

  async makeImageData(
    ctx: CanvasRenderingContext2D,
    layoutRecords: LaidOutFeatureRect[],
    props: RenderArgsDeserializedWithFeaturesAndLayout,
  ) {
    layoutRecords
      .filter(f => !!f)
      .forEach(fRect => {
        this.drawRect(ctx, fRect, props)
      })

    if (props.exportSVG) {
      // console.log(
      //   bpSpanPx(
      //     props.regions[0].start,
      //     props.regions[0].start + 1,
      //     props.regions[0],
      //     props.bpPerPx,
      //   )[0],
      // )
      postDraw({
        ctx,
        layoutRecords: layoutRecords.map(f => ({
          label: f.label,
          description: f.description,
          l: f.l,
          t: f.t,
          start: f.f.get('start'),
          end: f.f.get('end'),
        })),
        offsetPx: 0,
        ...props,
      })
    }
  }

  async render(renderProps: RenderArgsDeserialized) {
    const { bpPerPx, regions } = renderProps
    const features = await this.getFeatures(renderProps)
    const layout = this.createLayoutInWorker(renderProps)
    const [region] = regions
    const featureMap = features
    const layoutRecords = iterMap(
      featureMap.values(),
      feature => this.layoutFeature(feature, layout, renderProps),
      featureMap.size,
    ).filter((f): f is LaidOutFeatureRect => !!f)
    const width = (region.end - region.start) / bpPerPx
    const height = Math.max(layout.getTotalHeight(), 1)

    const res = await renderToAbstractCanvas(width, height, renderProps, ctx =>
      this.makeImageData(ctx, layoutRecords, {
        ...renderProps,
        layout,
        features,
        width,
        height,
      }),
    )

    const results = await super.render({
      ...renderProps,
      ...res,
      layoutRecords,
      features,
      layout,
      height,
      width,
    })

    return {
      ...results,
      ...res,
      layoutRecords: layoutRecords.map(f => ({
        label: f.label,
        description: f.description,
        l: f.l,
        t: f.t,
        start: f.f.get('start'),
        end: f.f.get('end'),
      })),
      features,
      layout,
      height,
      width,
      maxHeightReached: layout.maxHeightReached,
    }
  }
}

export function postDraw({
  ctx,
  layoutRecords,
  offsetPx,
  regions,
}: {
  ctx: CanvasRenderingContext2D
  regions: { start: number }[]
  offsetPx: number
  layoutRecords: any
}) {
  const [region] = regions

  ctx.fillStyle = 'black'
  ctx.font = '9px sans-serif'
  layoutRecords
    .filter(f => !!f)
    .forEach(record => {
      const {
        start,
        end,
        l,
        t,
        label: { text, yOffset },
      } = record

      if (start < region.start && region.start < end) {
        ctx.fillText(text, offsetPx, t + yOffset)
      } else {
        ctx.fillText(text, l, t + yOffset)
      }
    })

  ctx.fillStyle = 'blue'
  layoutRecords
    .filter(f => !!f)
    .forEach(record => {
      const {
        start,
        end,
        l,
        t,
        description: { text, yOffset },
      } = record
      if (start < region.start && region.start < end) {
        ctx.fillText(text, offsetPx, t + yOffset)
      } else {
        ctx.fillText(text, l, t + yOffset)
      }
    })
}
