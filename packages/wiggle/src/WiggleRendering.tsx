import * as d3 from 'd3'
import { observer } from 'mobx-react'
import React, { useRef } from 'react'
import { featureSpanPx } from '@gmod/jbrowse-core/util'
import { Region } from '@gmod/jbrowse-core/util/types'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { getScale } from './util'

interface BaseProps {
  regions: Region[]
  features: Map<string, Feature>
  bpPerPx: number
  width: number
  height: number
  onMouseLeave: Function
  onMouseMove: Function
  forceSvg: boolean
}
function WiggleRendering(props: BaseProps) {
  const {
    regions,
    features,
    bpPerPx,
    width,
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
      style={{ width: '100%', height: '100%' }}
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

function LineRendering(props: any) {
  const { features, regions, height, scaleOpts, bpPerPx } = props
  const [region] = regions
  const scale = getScale({ ...scaleOpts, range: [height, 0] })

  const line = d3
    .line()
    .y(d => scale(d[1]))
    .context(null)
  const data = []

  for (const feature of features.values()) {
    const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
    const score = feature.get('score')
    data.push([leftPx, score])
    data.push([rightPx, score])
  }

  return <path d={line(data)} fill="none" stroke="blue" />
}

export default observer(WiggleRendering)
