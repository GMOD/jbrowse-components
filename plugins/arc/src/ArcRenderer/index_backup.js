import React from 'react'
import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import {
  ConfigurationSchema,
  readConfObject,
} from '@jbrowse/core/configuration'
import { bpSpanPx } from '@jbrowse/core/util'

export const configSchema = ConfigurationSchema(
  'ArcRenderer',
  {
    color: {
      type: 'color',
      description: 'the color of the arcs',
      defaultValue: 'darkblue',
    },
    thickness: {
      type: 'number',
      description: 'the thickness of the arcs',
      defaultValue: 4,
    },
    label: {
      type: 'string',
      description: 'the label to appear at the apex of the arcs',
      defaultValue: `jexl:get(feature,'label')`,
    },
    caption: {
      type: 'string',
      description:
        'the caption to appear when hovering over any point on the arcs',
      defaultValue: `jexl:get(feature,'caption')`,
    },
  },
  { explicitlyTyped: true },
)

export const ReactComponent = props => {
  const { width, height, arcsRendered } = props
  console.log('gets here', width, height, arcsRendered)

  return (
    <svg
      className="ArcRendering"
      width={width}
      height={height}
      style={{
        position: 'relative',
      }}
    >
      {arcsRendered}
    </svg>
  )
}

export default class ArcRenderer extends FeatureRendererType {
  supportsSVG = true

  makeImageData(props) {
    const { features, config, regions, bpPerPx } = props
    const [region] = regions
    const arcsRendered = []

    for (const feature of features.values()) {
      const [left, right] = bpSpanPx(
        feature.get('start'),
        feature.get('end'),
        region,
        bpPerPx,
      )

      const id = feature.uniqueId
      const stroke = readConfObject(config, 'color', [feature])
      const label = readConfObject(config, 'label', [feature])
      const strokeWidth = readConfObject(config, 'thickness', [feature])

      arcsRendered.push(
        <g>
          <path
            id={id}
            d={`M 70 60 C ${left} ${200}, ${right} 200, ${right} 0`}
            stroke={stroke}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <text>
            <textPath href={`#${id}`} startOffset="50%">
              {label}
            </textPath>
          </text>
        </g>,
      )

      // ctx.beginPath()
      // ctx.strokeStyle = readConfObject(config, 'color', [feature])
      // ctx.lineWidth = readConfObject(config, 'thickness', [feature])
      // ctx.moveTo(left, 0)
      // ctx.bezierCurveTo(left, 200, right, 200, right, 0)
      // ctx.stroke()
    }

    return arcsRendered
  }

  async render(renderProps) {
    const { regions, bpPerPx } = renderProps
    const region = regions[0]
    const width = (region.end - region.start) / bpPerPx
    const height = 500
    const features = await this.getFeatures(renderProps)

    const arcsRendered = this.makeImageData({
      ...renderProps,
      features,
    })

    // const res = await renderToAbstractCanvas(width, height, renderProps, ctx =>
    //   this.makeImageData(ctx, {
    //     ...renderProps,
    //     features,
    //   }),
    // )

    // const results = await super.render({
    //   ...renderProps,
    //   ...res,
    //   features,
    //   height,
    //   width,
    // })

    console.log('gets here_')

    return {
      width,
      height,
      arcsRendered,
    }
  }
}
