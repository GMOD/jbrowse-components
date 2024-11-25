import React, { useRef } from 'react'

import { PrerenderedCanvas } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

const WiggleRendering = observer(function (props: {
  regions: Region[]
  features: Map<string, Feature>
  bpPerPx: number
  width: number
  height: number
  blockKey: string
  onMouseLeave?: (event: React.MouseEvent) => void
  onMouseMove?: (event: React.MouseEvent, arg?: string) => void
  onFeatureClick?: (event: React.MouseEvent, arg?: string) => void
}) {
  const {
    regions,
    features,
    bpPerPx,
    width,
    height,
    onMouseLeave,
    onMouseMove,
    onFeatureClick,
  } = props
  const region = regions[0]!
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
    let featureUnderMouse: Feature | undefined
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
      onMouseMove={e => onMouseMove?.(e, getFeatureUnderMouse(e.clientX)?.id())}
      onClick={e => onFeatureClick?.(e, getFeatureUnderMouse(e.clientX)?.id())}
      onMouseLeave={e => onMouseLeave?.(e)}
      style={{
        overflow: 'visible',
        position: 'relative',
        height,
      }}
    >
      <PrerenderedCanvas {...props} />
    </div>
  )
})

export default WiggleRendering
