import { useMemo, useRef, useState } from 'react'

import { PrerenderedCanvas } from '@jbrowse/core/ui'
import Flatbush from '@jbrowse/core/util/flatbush'
import { observer } from 'mobx-react'

import { formatInterbaseStats, getInterbaseTypeLabel } from '../types'

import type { InterbaseIndicatorItem } from '../types'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

function getItemLabel(item: InterbaseIndicatorItem | undefined) {
  if (!item) {
    return undefined
  }
  const { type, count, total, avgLength, minLength, maxLength, topSequence } =
    item
  return `${getInterbaseTypeLabel(type)}: ${formatInterbaseStats(count, total, type, { avgLength, minLength, maxLength, topSequence })}`
}

const SNPCoverageRendering = observer(function (props: {
  regions: Region[]
  features: Map<string, Feature>
  bpPerPx: number
  width: number
  height: number
  blockKey: string
  clickMap?: {
    flatbush: ArrayBuffer
    items: InterbaseIndicatorItem[]
  }
  onMouseLeave?: (event: React.MouseEvent) => void
  onMouseMove?: (
    event: React.MouseEvent,
    featureId?: string,
    extra?: string,
  ) => void
  onFeatureClick?: (event: React.MouseEvent, featureId?: string) => void
  onIndicatorClick?: (
    event: React.MouseEvent,
    item: InterbaseIndicatorItem,
  ) => void
}) {
  const {
    regions,
    features,
    bpPerPx,
    width,
    height,
    clickMap,
    onMouseLeave,
    onMouseMove,
    onFeatureClick,
    onIndicatorClick,
  } = props
  const region = regions[0]!
  const ref = useRef<HTMLDivElement>(null)
  const [isOverIndicator, setIsOverIndicator] = useState(false)

  const flatbush = useMemo(
    () => (clickMap?.flatbush ? Flatbush.from(clickMap.flatbush) : undefined),
    [clickMap?.flatbush],
  )
  const items = clickMap?.items

  function getFeatureUnderMouse(eventClientX: number) {
    let offset = 0
    if (ref.current) {
      offset = ref.current.getBoundingClientRect().left
    }
    const offsetX = eventClientX - offset
    const px = region.reversed ? width - offsetX : offsetX
    const clientBp = region.start + bpPerPx * px
    let featureUnderMouse: Feature | undefined
    for (const feature of features.values()) {
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

  function getInterbaseItemUnderMouse(clientX: number, clientY: number) {
    if (!flatbush || !items || !ref.current) {
      return undefined
    }
    const rect = ref.current.getBoundingClientRect()
    const offsetX = clientX - rect.left
    const offsetY = clientY - rect.top
    // Use a small search box around the cursor for better hit detection
    const search = flatbush.search(
      offsetX,
      offsetY,
      offsetX + 1.5,
      offsetY + 1.5,
    )
    if (search.length === 0) {
      return undefined
    }
    if (search.length === 1) {
      return items[search[0]!]
    }
    // When multiple items overlap, prioritize those with higher read percentage
    const sorted = search
      .map(idx => items[idx]!)
      .sort((a, b) => b.count / b.total - a.count / a.total)
    return sorted[0]
  }

  return (
    <div
      ref={ref}
      data-testid="snpcoverage-rendering-test"
      onMouseMove={e => {
        const item = getInterbaseItemUnderMouse(e.clientX, e.clientY)
        const label = getItemLabel(item)
        setIsOverIndicator(!!item)
        if (label) {
          onMouseMove?.(e, undefined, label)
        } else {
          onMouseMove?.(e, getFeatureUnderMouse(e.clientX)?.id())
        }
      }}
      onClick={e => {
        const item = getInterbaseItemUnderMouse(e.clientX, e.clientY)
        if (item && onIndicatorClick) {
          onIndicatorClick(e, item)
        } else {
          onFeatureClick?.(e, getFeatureUnderMouse(e.clientX)?.id())
        }
      }}
      onMouseLeave={e => {
        setIsOverIndicator(false)
        onMouseLeave?.(e)
      }}
      style={{
        overflow: 'visible',
        position: 'relative',
        height,
        cursor: isOverIndicator ? 'pointer' : undefined,
      }}
    >
      <PrerenderedCanvas {...props} />
    </div>
  )
})

export default SNPCoverageRendering
