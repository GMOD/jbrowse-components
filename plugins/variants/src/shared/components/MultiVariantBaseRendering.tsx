import { useMemo, useRef } from 'react'

import { PrerenderedCanvas } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'
import RBush from 'rbush'

import type { Source } from '../types'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

interface RBushData {
  minX: number
  maxX: number
  minY: number
  maxY: number
  name: string
  genotype: string
}

type SerializedRBush = any

function minElt<T>(arr: Iterable<T>, cb: (arg: T) => number) {
  let min = Infinity
  let minElement: T | undefined
  for (const entry of arr) {
    const val = cb(entry)

    if (val < min) {
      min = val
      minElement = entry
    }
  }
  return minElement
}

const MultiVariantRendering = observer(function (props: {
  regions: Region[]
  features: Map<string, Feature>
  bpPerPx: number
  width: number
  height: number
  sources: Source[]
  scrollTop: number
  totalHeight: number
  rbush: SerializedRBush
  displayModel: any
  onMouseLeave?: (event: React.MouseEvent) => void
  onMouseMove?: (event: React.MouseEvent, arg?: Feature) => void
  onFeatureClick?: (event: React.MouseEvent, arg?: Feature) => void
}) {
  const { totalHeight, scrollTop } = props
  const { rbush, displayModel } = props
  const ref = useRef<HTMLDivElement>(null)
  const rbush2 = useMemo(() => new RBush<RBushData>().fromJSON(rbush), [rbush])

  function getFeatureUnderMouse(eventClientX: number, eventClientY: number) {
    let offsetX = 0
    let offsetY = 0
    if (ref.current) {
      const r = ref.current.getBoundingClientRect()
      offsetX = eventClientX - r.left
      offsetY = eventClientY - r.top - (displayModel?.scrollTop || 0)
    }

    const x = rbush2.search({
      minX: offsetX,
      maxX: offsetX + 1,
      minY: offsetY,
      maxY: offsetY + 1,
    })
    if (x.length) {
      const { minX, minY, maxX, maxY, ...rest } = minElt(
        x,
        elt => elt.maxX - elt.minX,
      )!
      return rest
    } else {
      return undefined
    }
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
