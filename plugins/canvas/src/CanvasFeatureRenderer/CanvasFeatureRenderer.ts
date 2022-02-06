import BoxRendererType, {
  RenderArgs,
  RenderArgsSerialized,
  RenderArgsDeserialized as BoxRenderArgsDeserialized,
  RenderResults,
  ResultsSerialized,
  ResultsDeserialized,
} from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import { Region } from '@jbrowse/core/util/types'
import { BaseLayout } from '@jbrowse/core/util/layouts/BaseLayout'
import { iterMap, Feature } from '@jbrowse/core/util'
import { renderToAbstractCanvas } from '@jbrowse/core/util/offscreenCanvasUtils'

// locals
import BoxGlyph from './FeatureGlyphs/Box'
import GeneGlyph from './FeatureGlyphs/Gene'
import { PostDrawFeatureRect, LaidOutFeatureRect } from './FeatureGlyph'

export interface PostDrawFeatureRectWithGlyph extends PostDrawFeatureRect {
  glyph: BoxGlyph
}

export interface LaidOutFeatureRectWithGlyph extends LaidOutFeatureRect {
  glyph: BoxGlyph
}

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
  ): LaidOutFeatureRectWithGlyph | null {
    const [region] = props.regions
    let glyph
    if (feature.get('type') === 'gene') {
      glyph = new GeneGlyph()
    } else {
      glyph = new BoxGlyph()
    }
    const fRect = glyph.layoutFeature({ region, ...props }, layout, feature)
    return fRect ? { ...fRect, glyph } : null
  }

  drawRect(
    ctx: CanvasRenderingContext2D,
    fRect: LaidOutFeatureRectWithGlyph,
    props: RenderArgsDeserialized,
  ) {
    const { regions } = props
    const [region] = regions
    fRect.glyph.renderFeature(ctx, { ...props, region }, fRect)
  }

  async makeImageData(
    ctx: CanvasRenderingContext2D,
    layoutRecords: LaidOutFeatureRectWithGlyph[],
    props: RenderArgsDeserializedWithFeaturesAndLayout,
  ) {
    layoutRecords.forEach(fRect => {
      this.drawRect(ctx, fRect, props)
    })

    if (props.exportSVG) {
      postDraw({
        ctx,
        layoutRecords: layoutRecords,
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
    ).filter((f): f is LaidOutFeatureRectWithGlyph => !!f)

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
      layoutRecords: layoutRecords.map(rec => ({
        label: rec.label,
        description: rec.description,
        l: rec.l,
        t: rec.t,
        f: {
          start: rec.f.get('start'),
          end: rec.f.get('end'),
          type: rec.f.get('type'),
        },
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
  regions: Region[]
  offsetPx: number
  layoutRecords: PostDrawFeatureRectWithGlyph[]
}) {
  ctx.fillStyle = 'black'
  ctx.font = '10px sans-serif'
  layoutRecords
    .filter(f => !!f)
    .forEach(record =>
      record.glyph.postDraw(ctx, {
        record,
        regions,
        offsetPx,
      }),
    )
}
