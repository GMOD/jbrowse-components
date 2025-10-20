import { useCallback, useRef, useState, useMemo } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { observer } from 'mobx-react'

import BaseDisplayComponent from '../../shared/components/BaseDisplayComponent'

import type { LinearReadStackDisplayModel } from '../model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const Stack = observer(function ({
  model,
}: {
  model: LinearReadStackDisplayModel
}) {
  const view = getContainingView(model) as LGV
  const width = Math.round(view.dynamicBlocks.totalWidthPx)
  const height = model.height
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredFeature, setHoveredFeature] = useState<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)

  // Convert flatbush data to Flatbush instance
  const flatbushIndex = useMemo(() => {
    return model.featureLayout ? Flatbush.from(model.featureLayout.data) : null
  }, [model.featureLayout])

  // biome-ignore lint/correctness/useExhaustiveDependencies:
  const cb = useCallback(
    (ref: HTMLCanvasElement) => {
      model.setRef(ref)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, width, height],
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies:
  const mouseoverCb = useCallback(
    (ref: HTMLCanvasElement) => {
      model.setMouseoverRef(ref)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, width, height],
  )

  const onMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!containerRef.current || !flatbushIndex) {
        setHoveredFeature(null)
        return
      }

      const rect = containerRef.current.getBoundingClientRect()
      const offsetX = event.clientX - rect.left
      const offsetY = event.clientY - rect.top

      // Search for features at this position
      const results = flatbushIndex.search(offsetX, offsetY, offsetX + 1, offsetY + 1)

      if (results.length > 0) {
        const featureIndex = results[0]!
        const feature = model.featuresForFlatbush[featureIndex]

        if (feature) {
          setHoveredFeature({
            x: feature.x1,
            y: feature.y1,
            width: feature.x2 - feature.x1,
            height: feature.y2 - feature.y1,
          })
        } else {
          setHoveredFeature(null)
        }
      } else {
        setHoveredFeature(null)
      }
    },
    [flatbushIndex, model.featuresForFlatbush],
  )

  const onMouseLeave = useCallback(() => {
    setHoveredFeature(null)
  }, [])

  // note: the position absolute below avoids scrollbar from appearing on track
  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width, height }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      <canvas
        data-testid="stack-canvas"
        ref={cb}
        style={{ width, height, position: 'absolute', left: 0, top: 0 }}
        width={width * 2}
        height={height * 2}
      />
      <canvas
        data-testid="stack-mouseover-canvas"
        ref={mouseoverCb}
        style={{ width, height, position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}
        width={width * 2}
        height={height * 2}
      />
      {hoveredFeature ? (
        <div
          style={{
            position: 'absolute',
            left: hoveredFeature.x,
            top: hoveredFeature.y,
            width: hoveredFeature.width,
            height: hoveredFeature.height,
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            pointerEvents: 'none',
          }}
        />
      ) : null}
    </div>
  )
})

const LinearReadStackReactComponent = observer(function ({
  model,
}: {
  model: LinearReadStackDisplayModel
}) {
  return (
    <BaseDisplayComponent model={model}>
      <Stack model={model} />
    </BaseDisplayComponent>
  )
})
export default LinearReadStackReactComponent
