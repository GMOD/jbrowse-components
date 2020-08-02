import * as d3 from 'd3'
import { observer } from 'mobx-react'
import React, { useRef } from 'react'
import { featureSpanPx } from '@gmod/jbrowse-core/util'
import { Region } from '@gmod/jbrowse-core/util/types'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { getScale } from './util'
import { WiggleBaseRendererProps } from './WiggleBaseRenderer'

interface WiggleRenderingProps extends WiggleBaseRendererProps {
  onMouseLeave: Function
  onMouseMove: Function
}
function WiggleRendering(props: WiggleRenderingProps) {
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
  const ref = useRef<SVGSVGElement>(null)

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

function LineRendering(props: WiggleRenderingProps) {
  const { features, regions, height, scaleOpts, bpPerPx } = props
  const [region] = regions
  const scale = getScale({ ...scaleOpts, range: [height, 0] })

  type D = [number, Feature]
  const line = d3
    .line()
    .y((d: D) => scale(d[1].get('score')))
    .context(null)

  const area = d3
    .area()
    .y0((d: D) => scale(d[1].get('minScore')))
    .y1((d: D) => scale(d[1].get('maxScore')))
    .defined((d: D) => d[1].get('summary'))
    .context(null)
  const data = []

  for (const feature of features.values()) {
    const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
    data.push([leftPx, feature])
    data.push([rightPx, feature])
  }

  return (
    <>
      <path d={line(data)} fill="none" stroke="rgb(0,0,255)" />
      <path d={area(data)} fill="rgb(0,0,255,0.5)" stroke="none" />
    </>
  )
}

export default observer(WiggleRendering)
