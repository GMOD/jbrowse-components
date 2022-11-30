import { observer } from 'mobx-react'
import React, { useRef } from 'react'

import { Region } from '@jbrowse/core/util/types'
import { Feature } from '@jbrowse/core/util'
import { PrerenderedCanvas } from '@jbrowse/core/ui'

function WiggleRendering(props: {
  regions: Region[]
  features: Map<string, Feature>
  bpPerPx: number
  width: number
  height: number
  onMouseLeave: Function
  onMouseMove: Function
  onFeatureClick: Function
  blockKey: string
}) {
  const {
    regions,
    features,
    bpPerPx,
    width,
    height,
    onMouseLeave = () => {},
    onMouseMove = () => {},
    onFeatureClick = () => {},
  } = props
  const [region] = regions
  const ref = useRef<HTMLDivElement>(null)

  function getFeatureUnderMouse(eventClientX: number) {
    // calculates feature under mouse
    let offset = 0
    if (ref.current) {
      offset = ref.current.getBoundingClientRect().left
    }
    const offsetX = eventClientX - offset
    const px = region.reversed ? width - offsetX : offsetX
    const clientBp = region.start + bpPerPx * px
    let featureUnderMouse
    for (const feature of features.values()) {
      // bpPerPx added to the end to accommodate "reduced features" (one feature per px)
      if (
        clientBp <= feature.get('end') + bpPerPx &&
        clientBp >= feature.get('start')
      ) {
        featureUnderMouse = feature
        break
      }
    }
    return featureUnderMouse
  }
  return (
    <div
      ref={ref}
      data-testid="wiggle-rendering-test"
      onMouseMove={event =>
        onMouseMove(event, getFeatureUnderMouse(event.clientX)?.id())
      }
      onClick={event =>
        onFeatureClick(event, getFeatureUnderMouse(event.clientX)?.id())
      }
      onMouseLeave={event => onMouseLeave(event)}
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
