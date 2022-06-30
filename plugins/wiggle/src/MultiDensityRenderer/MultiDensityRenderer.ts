import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { featureSpanPx, Feature, Region } from '@jbrowse/core/util'
import { getScale, groupBy, ScaleOpts } from '../util'
import WiggleBaseRenderer, {
  RenderArgsDeserializedWithFeatures,
} from '../WiggleBaseRenderer'

const colors = ['red', 'green', 'blue', 'orange']

export default class MultiXYPlotRenderer extends WiggleBaseRenderer {
  async draw(
    ctx: CanvasRenderingContext2D,
    props: RenderArgsDeserializedWithFeatures,
  ) {
    const { bpPerPx, regions, features } = props
    const [region] = regions
    const groups = groupBy([...features.values()], f => f.get('source'))
    const list = Object.values(groups)
    const height = props.height / list.length
    const width = (region.end - region.start) / bpPerPx
    ctx.save()
    list.forEach((features, idx) => {
      this.drawFeats(ctx, {
        ...props,
        features,
        height,
        color: colors[idx],
        idx,
      })
      ctx.strokeStyle = 'rgba(200,200,200,0.8)'
      ctx.beginPath()
      ctx.moveTo(0, height)
      ctx.lineTo(width, height)
      ctx.stroke()
      ctx.translate(0, height)
    })
    ctx.restore()
  }
  drawFeats(
    ctx: CanvasRenderingContext2D,
    props: {
      features: Feature[]
      bpPerPx: number
      regions: Region[]
      scaleOpts: ScaleOpts
      height: number
      ticks: { values: number[] }
      config: AnyConfigurationModel
      displayCrossHatches: boolean
      color: string
      exportSVG?: { rasterizeLayers?: boolean }
      idx: number
    },
  ) {
    const { features, bpPerPx, regions, scaleOpts, height, config } = props
    const [region] = regions
    const pivot = readConfObject(config, 'bicolorPivot')
    const pivotValue = readConfObject(config, 'bicolorPivotValue')
    const negColor = readConfObject(config, 'negColor')
    const posColor = readConfObject(config, 'posColor')
    const color = readConfObject(config, 'color')
    let colorCallback
    if (color === '#f0f') {
      const colorScale =
        pivot !== 'none'
          ? getScale({
              ...scaleOpts,
              pivotValue,
              range: [negColor, 'white', posColor],
            })
          : getScale({ ...scaleOpts, range: ['white', posColor] })
      colorCallback = (feature: Feature) => colorScale(feature.get('score'))
    } else {
      colorCallback = (feature: Feature) =>
        readConfObject(config, 'color', { feature })
    }

    for (let i = 0; i < features.length; i++) {
      const feature = features[i]
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
      const w = rightPx - leftPx + 0.3 // fudge factor for subpixel rendering
      ctx.fillStyle = colorCallback(feature)
      ctx.fillRect(leftPx, 0, w, height)
    }
  }
}
