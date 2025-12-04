import { useMemo, useRef, useState } from 'react'

import { PrerenderedCanvas } from '@jbrowse/core/ui'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import Flatbush from '@jbrowse/core/util/flatbush'
import { observer } from 'mobx-react'

import HicColorLegend from './HicColorLegend'

import type { HicFlatbushItem } from '../types'
import type { Region } from '@jbrowse/core/util/types'

const SQRT2 = Math.sqrt(2)

/**
 * Transform screen coordinates to the unrotated coordinate space.
 * The canvas is rotated by -45 degrees, so we apply the inverse rotation (+45 degrees).
 * Also accounts for the yScalar transformation.
 */
function screenToUnrotated(
  screenX: number,
  screenY: number,
  yScalar: number,
): { x: number; y: number } {
  // First undo the yScalar
  const scaledY = screenY / yScalar

  // The canvas transformation is: rotate(-π/4) then scale(1, yScalar)
  // So screen coords = scale(1, yScalar) * rotate(-π/4) * original
  // To invert: original = rotate(+π/4) * scale(1, 1/yScalar) * screen

  // First undo scale: (screenX, screenY/yScalar)
  // Then undo rotation by +π/4:
  // For +π/4: cos = sin = 1/√2
  // x = screenX * cos(π/4) - scaledY * sin(π/4) = (screenX - scaledY) / √2
  // y = screenX * sin(π/4) + scaledY * cos(π/4) = (screenX + scaledY) / √2

  const x = (screenX - scaledY) / SQRT2
  const y = (screenX + scaledY) / SQRT2

  return { x, y }
}

const HicRendering = observer(function HicRendering(props: {
  blockKey: string
  width: number
  height: number
  regions: Region[]
  bpPerPx: number
  flatbush?: ArrayBuffer
  items?: HicFlatbushItem[]
  maxScore?: number
  binWidth?: number
  yScalar?: number
  colorScheme?: string
  useLogScale?: boolean
  onMouseMove?: (
    event: React.MouseEvent,
    featureId?: string,
    label?: string,
  ) => void
  onMouseLeave?: (event: React.MouseEvent) => void
}) {
  const {
    width,
    height,
    flatbush,
    items = [],
    yScalar = 1,
    maxScore = 0,
    colorScheme,
    useLogScale,
  } = props
  const canvasWidth = Math.ceil(width)
  const ref = useRef<HTMLDivElement>(null)
  const [itemUnderMouse, setItemUnderMouse] = useState<HicFlatbushItem>()
  const [mouseCoord, setMouseCoord] = useState<{ x: number; y: number }>()

  const flatbush2 = useMemo(
    () => (flatbush ? Flatbush.from(flatbush) : undefined),
    [flatbush],
  )

  function handleMouseMove(event: React.MouseEvent) {
    if (!ref.current) {
      return
    }

    const rect = ref.current.getBoundingClientRect()
    const screenX = event.clientX - rect.left
    const screenY = event.clientY - rect.top

    setMouseCoord({ x: event.clientX + 15, y: event.clientY })

    if (!flatbush2 || !items.length) {
      setItemUnderMouse(undefined)
      return
    }

    // Transform screen coordinates to unrotated space for Flatbush query
    const { x, y } = screenToUnrotated(screenX, screenY, yScalar)

    // Query Flatbush with a small region around the transformed point
    const search = flatbush2.search(x - 1, y - 1, x + 1, y + 1)
    const item = search.length ? items[search[0]!] : undefined

    setItemUnderMouse(item)
  }

  function handleMouseLeave() {
    setItemUnderMouse(undefined)
    setMouseCoord(undefined)
  }

  return (
    <div
      ref={ref}
      style={{
        position: 'relative',
        width: canvasWidth,
        height,
        cursor: itemUnderMouse ? 'pointer' : 'default',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <PrerenderedCanvas
        {...props}
        style={{ position: 'absolute', left: 0, top: 0 }}
      />
      {maxScore > 0 ? (
        <HicColorLegend
          maxScore={maxScore}
          colorScheme={colorScheme}
          useLogScale={useLogScale}
        />
      ) : null}
      {itemUnderMouse && mouseCoord ? (
        <BaseTooltip clientPoint={mouseCoord}>
          <div>Score: {itemUnderMouse.counts.toLocaleString()}</div>
        </BaseTooltip>
      ) : null}
    </div>
  )
})

export default HicRendering
