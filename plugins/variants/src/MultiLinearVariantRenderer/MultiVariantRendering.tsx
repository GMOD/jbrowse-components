import { useMemo, useRef } from 'react'

import { PrerenderedCanvas } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'
import RBush from 'rbush'

import type { Source } from '../shared/types'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

const MultiVariantRendering = observer(function (props: {
  regions: Region[]
  features: Map<string, Feature>
  bpPerPx: number
  width: number
  height: number
  sources: Source[]
  scrollTop: number
  totalHeight: number
  rbush: RBush<{ genotype: string }>
  displayModel: any
  onMouseLeave?: (event: React.MouseEvent) => void
  onMouseMove?: (event: React.MouseEvent, arg?: Feature) => void
  onFeatureClick?: (event: React.MouseEvent, arg?: Feature) => void
}) {
  const { totalHeight, scrollTop } = props
  const { rbush, displayModel } = props
  const ref = useRef<HTMLDivElement>(null)
  const rbush2 = useMemo(
    () => new RBush<{ genotype: string }>().fromJSON(rbush),
    [rbush],
  )

  function getFeatureUnderMouse(eventClientX: number, eventClientY: number) {
    let offsetX = 0
    let offsetY = 0
    if (ref.current) {
      const r = ref.current.getBoundingClientRect()
      offsetX = eventClientX - r.left
      offsetY = eventClientY - r.top
    }
    const ret = rbush2.search({
      minX: offsetX,
      maxX: offsetX + 3,
      minY: offsetY,
      maxY: offsetY + 3,
    })
    return ret[0]?.genotype
  }

  return (
    <div
      ref={ref}
      onMouseMove={e =>
        displayModel.setHoveredGenotype?.(
          getFeatureUnderMouse(e.clientX, e.clientY),
        )
      }
      onMouseLeave={() => {
        displayModel.setHoveredGenotype?.(undefined)
      }}
      onMouseOut={() => {
        displayModel.setHoveredGenotype?.(undefined)
      }}
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
