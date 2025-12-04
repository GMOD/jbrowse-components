import { useCallback, useMemo, useRef, useState } from 'react'

import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { getContainingView, toLocale } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { observer } from 'mobx-react'

import BaseDisplayComponent from './BaseDisplayComponent'

import type { HicFlatbushItem } from '../../HicRenderer/types'
import type { LinearHicDisplayModel } from '../model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

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
  const scaledY = screenY / yScalar
  const x = (screenX - scaledY) / SQRT2
  const y = (screenX + scaledY) / SQRT2
  return { x, y }
}

const HicCanvas = observer(function ({
  model,
}: {
  model: LinearHicDisplayModel
}) {
  const view = getContainingView(model) as LGV
  const screenWidth = Math.round(view.dynamicBlocks.totalWidthPx)
  const { offsetPx } = view
  const { height, drawn, loading, flatbush, flatbushItems, yScalar } = model

  // Adjust canvas width and position when offsetPx is negative
  const canvasWidth = offsetPx < 0 ? screenWidth + offsetPx : screenWidth
  const canvasLeft = offsetPx < 0 ? -offsetPx : 0

  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredItem, setHoveredItem] = useState<HicFlatbushItem>()
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number }>()
  const [localMousePos, setLocalMousePos] = useState<{ x: number; y: number }>()

  // Convert flatbush data to Flatbush instance
  const flatbushIndex = useMemo(
    () => (flatbush ? Flatbush.from(flatbush) : null),
    [flatbush],
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies:
  const cb = useCallback(
    (ref: HTMLCanvasElement) => {
      model.setRef(ref)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, canvasWidth, height],
  )

  const onMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!containerRef.current || !flatbushIndex || !flatbushItems.length) {
        setHoveredItem(undefined)
        setMousePosition(undefined)
        return
      }

      const rect = containerRef.current.getBoundingClientRect()
      const screenX = event.clientX - rect.left - canvasLeft
      const screenY = event.clientY - rect.top

      setMousePosition({ x: event.clientX, y: event.clientY })
      setLocalMousePos({ x: screenX, y: screenY })

      // Transform screen coordinates to unrotated space for Flatbush query
      const { x, y } = screenToUnrotated(screenX, screenY, yScalar)

      // Query Flatbush with a small region around the transformed point
      const results = flatbushIndex.search(x - 1, y - 1, x + 1, y + 1)

      if (results.length > 0) {
        const item = flatbushItems[results[0]!]
        setHoveredItem(item)
      } else {
        setHoveredItem(undefined)
      }
    },
    [flatbushIndex, flatbushItems, yScalar, canvasLeft],
  )

  const onMouseLeave = useCallback(() => {
    setHoveredItem(undefined)
    setMousePosition(undefined)
    setLocalMousePos(undefined)
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        cursor: hoveredItem && mousePosition ? 'crosshair' : undefined,
        position: 'relative',
        width: screenWidth,
        height,
      }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      <canvas
        data-testid={`hic_canvas${drawn && !loading ? '_done' : ''}`}
        ref={cb}
        style={{
          width: canvasWidth,
          height,
          position: 'absolute',
          left: canvasLeft,
        }}
        width={canvasWidth * 2}
        height={height * 2}
      />
      {hoveredItem && localMousePos ? (
        <svg
          style={{
            position: 'absolute',
            left: canvasLeft,
            top: 0,
            width: canvasWidth,
            height,
            pointerEvents: 'none',
          }}
        >
          <g stroke="#000" strokeWidth="1" fill="none">
            <path
              d={`M ${localMousePos.x - localMousePos.y} 0 L ${localMousePos.x} ${localMousePos.y} L ${localMousePos.x + localMousePos.y} 0`}
            />
          </g>
        </svg>
      ) : null}

      {hoveredItem && mousePosition ? (
        <BaseTooltip
          clientPoint={{ x: mousePosition.x + 15, y: mousePosition.y }}
        >
          <div>
            Score:{' '}
            {toLocale(
              hoveredItem.counts > 10
                ? Math.round(hoveredItem.counts)
                : hoveredItem.counts,
            )}
          </div>
        </BaseTooltip>
      ) : null}
    </div>
  )
})

const LinearHicReactComponent = observer(function ({
  model,
}: {
  model: LinearHicDisplayModel
}) {
  return (
    <BaseDisplayComponent model={model}>
      <HicCanvas model={model} />
    </BaseDisplayComponent>
  )
})

export default LinearHicReactComponent
