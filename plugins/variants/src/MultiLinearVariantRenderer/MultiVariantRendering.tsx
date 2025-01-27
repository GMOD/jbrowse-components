import { useRef } from 'react'

import { PrerenderedCanvas } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

import type { Source } from '../types'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

// locals

const MultiVariantRendering = observer(function (props: {
  regions: Region[]
  features: Map<string, Feature>
  bpPerPx: number
  width: number
  height: number
  sources: Source[]
  scrollTop: number
  totalHeight: number
  onMouseLeave?: (event: React.MouseEvent) => void
  onMouseMove?: (event: React.MouseEvent, arg?: Feature) => void
  onFeatureClick?: (event: React.MouseEvent, arg?: Feature) => void
}) {
  const { totalHeight, scrollTop } = props
  const ref = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={ref}
      style={{
        overflow: 'visible',
        position: 'relative',
        height: totalHeight,
      }}
    >
      <PrerenderedCanvas
        {...props}
        style={{
          position: 'absolute',
          left: 0,
          top: scrollTop,
        }}
      />
    </div>
  )
})

export default MultiVariantRendering
