import { observer } from 'mobx-react'
import React, { useRef } from 'react'

import { Region } from '@gmod/jbrowse-core/util/types'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { PrerenderedCanvas } from '@gmod/jbrowse-core/ui'

function WiggleRendering(props: {
  regions: Region[]
  features: Map<string, Feature>
  bpPerPx: number
  width: number
  height: number
  onMouseLeave: Function
  onMouseMove: Function
}) {
  const {
    regions,
    features,
    bpPerPx,
    width,
    height,
    onMouseLeave = () => {},
    onMouseMove = () => {},
  } = props
  const [region] = regions
  const ref = useRef<HTMLDivElement>(null)

  return (
    <div
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
      style={{
        overflow: 'visible',
        position: 'relative',
        height,
      }}
    >
      <PrerenderedCanvas {...props} />
    </div>
  )
}

export default observer(WiggleRendering)
