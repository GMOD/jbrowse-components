/* eslint-disable react/prop-types */
import React, { useRef } from 'react'
import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { featureSpanPx } from '@gmod/jbrowse-core/util'
import { getScale } from '@gmod/jbrowse-plugin-wiggle/src/util'
import * as d3 from 'd3'
import ConfigSchema from './configSchema'

export { default } from './SNPCoverageRenderer'

function WiggleRendering(props) {
  const {
    regions,
    features,
    bpPerPx,
    width,
    height,
    onMouseLeave = () => {},
    onMouseMove = () => {},
    forceSvg,
  } = props
  const region = regions[0]
  const ref = useRef(null)

  return forceSvg ? (
    <LineRendering {...props} />
  ) : (
    <svg
      style={{ width: '100%', height }}
      ref={ref}
      onMouseMove={event => {
        let offset = 0
        if (ref.current) {
          offset = ref.current.getBoundingClientRect().left
        }
        const offsetX = event.clientX - offset
        const px = region.reversed ? width - offsetX : offsetX
        const clientBp = region.start + bpPerPx * px
        let featureUnderMouse
        for (const feature of features.values()) {
          if (
            clientBp <= feature.get('end') &&
            clientBp >= feature.get('start')
          ) {
            featureUnderMouse = feature
            break
          }
        }

        onMouseMove(
          event,
          featureUnderMouse ? featureUnderMouse.id() : undefined,
        )
      }}
      onMouseLeave={event => onMouseLeave(event)}
      role="presentation"
      className="WiggleRendering"
    >
      <LineRendering {...props} />
    </svg>
  )
}

function LineRendering(props) {
  const { features, regions, height, scaleOpts, bpPerPx } = props
  const [region] = regions
  const scale = getScale({ ...scaleOpts, range: [height, 0] })

  const area = d3
    .area()
    .y0(height)
    .y1(d => scale(d[1].get('score')))
    .context(null)
  const data = []

  for (const feature of features.values()) {
    const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
    data.push([leftPx, feature])
    data.push([rightPx, feature])
  }

  const insRegex = /^ins.[A-Za-z0-9]/
  const colorForBase = {
    A: '#00bf00',
    C: '#4747ff',
    G: '#ffa500',
    T: '#f00',
    total: 'lightgrey',
  }

  const feats = [...features.values()]
  return (
    <>
      <path d={area(data)} fill="lightgrey" stroke="none" />
      {feats.map(feature => {
        const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
        const w = Math.max(rightPx - leftPx + 0.3, 1)
        // grab array with nestedtable's info, draw mismatches
        const infoArray = feature.get('snpinfo') || []
        let curr = 0
        return infoArray.map(function iterate(info) {
          if (!info || info.base === 'reference' || info.base === 'total') {
            return null
          }
          const fillStyle = info.base.match(insRegex)
            ? 'darkgrey'
            : colorForBase[info.base]

          curr += info.score
          const y = scale(curr)
          const nheight = -scale(curr + info.score) + y
          const element = (
            <rect
              key={`${feature.get('id')}-${info.base}`}
              x={leftPx}
              y={y}
              fill={fillStyle}
              width={w}
              height={nheight}
            />
          )
          return element
        })
      })}
    </>
  )
}

export { WiggleRendering as ReactComponent }

export const configSchema = ConfigurationSchema(
  'SNPCoverageRenderer',
  {},
  { baseConfiguration: ConfigSchema, explicitlyTyped: true },
)
