import { useCallback, useMemo, useRef, useState } from 'react'

import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { getContainingView } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { observer } from 'mobx-react'

import BaseDisplayComponent from '../../shared/components/BaseDisplayComponent'

import type { ReducedFeature } from '../../shared/fetchChains'
import type { LinearReadCloudDisplayModel } from '../model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const Cloud = observer(function ({
  model,
}: {
  model: LinearReadCloudDisplayModel
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
  const [hoveredFeatureData, setHoveredFeatureData] =
    useState<ReducedFeature | null>(null)
  const [mousePosition, setMousePosition] = useState<{
    x: number
    y: number
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
        setHoveredFeatureData(null)
        setMousePosition(null)
        return
      }

      const rect = containerRef.current.getBoundingClientRect()
      const offsetX = event.clientX - rect.left
      const offsetY = event.clientY - rect.top

      // Track mouse position for tooltip
      setMousePosition({ x: event.clientX, y: event.clientY })

      // Search for features at this position
      const results = flatbushIndex.search(
        offsetX,
        offsetY,
        offsetX + 1,
        offsetY + 1,
      )

      if (results.length > 0) {
        const featureIndex = results[0]!
        const feature = model.featuresForFlatbush[featureIndex]

        if (feature) {
          // Highlight the entire chain instead of just the individual feature
          setHoveredFeature({
            x: feature.chainMinX,
            y: feature.chainTop,
            width: feature.chainMaxX - feature.chainMinX,
            height: feature.chainHeight,
          })
          setHoveredFeatureData(feature.data)
        } else {
          setHoveredFeature(null)
          setHoveredFeatureData(null)
        }
      } else {
        setHoveredFeature(null)
        setHoveredFeatureData(null)
      }
    },
    [flatbushIndex, model.featuresForFlatbush],
  )

  const onMouseLeave = useCallback(() => {
    setHoveredFeature(null)
    setHoveredFeatureData(null)
    setMousePosition(null)
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
        data-testid="cloud-canvas"
        ref={cb}
        style={{ width, height, position: 'absolute', left: 0, top: 0 }}
        width={width * 2}
        height={height * 2}
      />
      <canvas
        data-testid="cloud-mouseover-canvas"
        ref={mouseoverCb}
        style={{
          width,
          height,
          position: 'absolute',
          left: 0,
          top: 0,
          pointerEvents: 'none',
        }}
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
      {hoveredFeatureData && mousePosition ? (
        <BaseTooltip
          clientPoint={{ x: mousePosition.x, y: mousePosition.y + 20 }}
          placement="bottom-start"
        >
          <div>
            <div>
              <strong>{hoveredFeatureData.name}</strong>
            </div>
            <div>
              {hoveredFeatureData.refName}:
              {hoveredFeatureData.start.toLocaleString()}-
              {hoveredFeatureData.end.toLocaleString()}
            </div>
            {hoveredFeatureData.tlen !== undefined &&
            hoveredFeatureData.tlen !== 0 ? (
              <div>Template length: {hoveredFeatureData.tlen}</div>
            ) : null}
          </div>
        </BaseTooltip>
      ) : null}
    </div>
  )
})

const LinearReadCloudReactComponent = observer(function ({
  model,
}: {
  model: LinearReadCloudDisplayModel
}) {
  return (
    <BaseDisplayComponent model={model}>
      <Cloud model={model} />
    </BaseDisplayComponent>
  )
})
export default LinearReadCloudReactComponent
