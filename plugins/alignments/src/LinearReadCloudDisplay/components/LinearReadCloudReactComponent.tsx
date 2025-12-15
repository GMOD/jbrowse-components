import { useCallback, useMemo, useRef, useState } from 'react'

import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { assembleLocString, getContainingView } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { observer } from 'mobx-react'

import BaseDisplayComponent from '../../shared/components/BaseDisplayComponent'

import type { ReducedFeature } from '../../shared/types'
import type { LinearReadCloudDisplayModel } from '../model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const Cloud = observer(function ({
  model,
}: {
  model: LinearReadCloudDisplayModel
}) {
  const view = getContainingView(model) as LGV
  const screenWidth = Math.round(view.dynamicBlocks.totalWidthPx)
  const offsetPx = view.offsetPx

  // Adjust canvas width and position when offsetPx is negative
  // This ensures drawing code doesn't need to account for negative offsets
  const canvasWidth = offsetPx < 0 ? screenWidth + offsetPx : screenWidth
  const canvasLeft = offsetPx < 0 ? -offsetPx : 0

  const width = screenWidth // Keep container full width
  const height = model.drawCloud ? model.height : model.layoutHeight
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredFeature, setHoveredFeature] = useState<{
    x: number
    y: number
    width: number
    height: number
  }>()
  const [hoveredFeatureData, setHoveredFeatureData] = useState<ReducedFeature>()
  const [mousePosition, setMousePosition] = useState<{
    x: number
    y: number
  }>()

  // Convert flatbush data to Flatbush instance
  const flatbushIndex = useMemo(() => {
    return model.featureLayout ? Flatbush.from(model.featureLayout.data) : null
  }, [model.featureLayout])

  // Look up the bounds of the selected feature by ID
  const selectedFeatureBounds = useMemo(() => {
    if (!model.selectedFeatureId) {
      return null
    }

    // Find the feature with the matching chain ID
    const feature = model.featuresForFlatbush.find(
      f => f.chainId === model.selectedFeatureId,
    )

    if (feature) {
      return {
        x: feature.chainMinX,
        y: feature.y1,
        width: feature.chainMaxX - feature.chainMinX,
        height: feature.y2 - feature.y1,
      }
    }

    return null
  }, [model.selectedFeatureId, model.featuresForFlatbush])

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
        setHoveredFeature(undefined)
        setHoveredFeatureData(undefined)
        setMousePosition(undefined)
        return
      }

      const rect = containerRef.current.getBoundingClientRect()
      // Adjust for canvas position when offsetPx < 0
      const offsetX = event.clientX - rect.left - canvasLeft
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
            y: feature.y1,
            width: feature.chainMaxX - feature.chainMinX,
            height: feature.y2 - feature.y1,
          })
          setHoveredFeatureData(feature.data)
        } else {
          setHoveredFeature(undefined)
          setHoveredFeatureData(undefined)
        }
      } else {
        setHoveredFeature(undefined)
        setHoveredFeatureData(undefined)
      }
    },
    [flatbushIndex, model.featuresForFlatbush, canvasLeft],
  )

  const onMouseLeave = useCallback(() => {
    setHoveredFeature(undefined)
    setHoveredFeatureData(undefined)
    setMousePosition(undefined)
  }, [])

  const onClick = useCallback(
    (event: React.MouseEvent) => {
      if (!containerRef.current || !flatbushIndex) {
        return
      }

      const rect = containerRef.current.getBoundingClientRect()
      // Adjust for canvas position when offsetPx < 0
      const offsetX = event.clientX - rect.left - canvasLeft
      const offsetY = event.clientY - rect.top

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
          model.selectFeature(feature.chain)
          // Store the chain ID for persistent highlighting
          model.setSelectedFeatureId(feature.chainId)
        }
      } else {
        // Clear selection when clicking on empty area
        model.setSelectedFeatureId(undefined)
      }
    },
    [flatbushIndex, model, canvasLeft],
  )

  // note: the position absolute below avoids scrollbar from appearing on track
  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width, height }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      <canvas
        data-testid={model.dataTestId}
        ref={cb}
        style={{
          width: canvasWidth,
          height,
          position: 'absolute',
          left: canvasLeft,
          top: 0,
        }}
        width={canvasWidth * 2}
        height={height * 2}
      />
      <canvas
        data-testid="cloud-mouseover-canvas"
        ref={mouseoverCb}
        style={{
          width: canvasWidth,
          height,
          position: 'absolute',
          left: canvasLeft,
          top: 0,
          pointerEvents: 'none',
        }}
        width={canvasWidth * 2}
        height={height * 2}
      />
      {selectedFeatureBounds ? (
        <div
          style={{
            position: 'absolute',
            left: selectedFeatureBounds.x + canvasLeft,
            top: selectedFeatureBounds.y,
            width: selectedFeatureBounds.width,
            height: selectedFeatureBounds.height,
            border: '2px solid #00b8ff',
            boxSizing: 'border-box',
            pointerEvents: 'none',
          }}
        />
      ) : null}
      {hoveredFeature ? (
        <div
          style={{
            position: 'absolute',
            left: hoveredFeature.x + canvasLeft,
            top: hoveredFeature.y,
            width: hoveredFeature.width,
            height: hoveredFeature.height,
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            pointerEvents: 'none',
          }}
        />
      ) : null}
      {hoveredFeatureData && mousePosition ? (
        <Tooltip
          hoveredFeatureData={hoveredFeatureData}
          mousePosition={mousePosition}
        />
      ) : null}
    </div>
  )
})
function Tooltip({
  hoveredFeatureData,
  mousePosition,
}: {
  hoveredFeatureData: ReducedFeature
  mousePosition: {
    x: number
    y: number
  }
}) {
  return (
    <BaseTooltip
      clientPoint={{
        x: mousePosition.x,
        y: mousePosition.y + 20,
      }}
      placement="bottom-start"
    >
      <div>
        <div>
          <strong>{hoveredFeatureData.name}</strong>
        </div>
        <div>{assembleLocString(hoveredFeatureData)}</div>
        {hoveredFeatureData.tlen !== 0 ? (
          <div>Template length: {hoveredFeatureData.tlen}</div>
        ) : null}
      </div>
    </BaseTooltip>
  )
}

const LinearReadCloudReactComponent = observer(function ({
  model,
}: {
  model: LinearReadCloudDisplayModel
}) {
  console.log('LinearReadCloudReactComponent')
  return (
    <BaseDisplayComponent model={model}>
      <Cloud model={model} />
    </BaseDisplayComponent>
  )
})
export default LinearReadCloudReactComponent
