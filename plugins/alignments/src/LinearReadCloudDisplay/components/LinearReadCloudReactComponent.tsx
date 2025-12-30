import { useCallback, useMemo, useRef, useState } from 'react'

import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import {
  assembleLocString,
  getContainingTrack,
  getContainingView,
  getSession,
  isSessionModelWithWidgets,
  toLocale,
} from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { NonBlockCanvasDisplayComponent as BaseDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import CloudYScaleBar from './CloudYScaleBar'
import {
  type FlatbushItem,
  flatbushItemToFeatureData,
  getFlatbushItemLabel,
} from '../../PileupRenderer/types'
import { PairType, getPairedType } from '../../shared/color'
import { orientationTypes } from '../../util'

import type { ReducedFeature } from '../../shared/types'
import type { LinearReadCloudDisplayModel } from '../model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

function getPairTypeDescription(data: ReducedFeature) {
  const pairType = getPairedType({
    type: 'insertSizeAndOrientation',
    f: {
      refName: data.refName,
      next_ref: data.next_ref,
      pair_orientation: data.pair_orientation,
      tlen: data.tlen,
      flags: data.flags,
    },
  })

  switch (pairType) {
    case PairType.LONG_INSERT:
      return 'Long insert size (colored red)'
    case PairType.SHORT_INSERT:
      return 'Short insert size (colored blue)'
    case PairType.INTER_CHROM:
      return data.next_ref
        ? `Inter-chromosomal (mate on ${data.next_ref})`
        : undefined
    case PairType.UNMAPPED_MATE:
      return 'Unmapped mate'
    case PairType.ABNORMAL_ORIENTATION: {
      const orientationType = orientationTypes.fr
      const orient = orientationType[data.pair_orientation || ''] || ''
      if (orient === 'RR') {
        return 'Both mates reverse strand'
      }
      if (orient === 'RL') {
        return 'Outward facing pair'
      }
      if (orient === 'LL') {
        return 'Both mates forward strand'
      }
      return `Abnormal orientation ${data.pair_orientation || ''}`
    }
    default:
      return undefined
  }
}

function FeatureTooltip({
  hoveredFeatureData,
  hasSupplementary,
  mousePosition,
}: {
  hoveredFeatureData: ReducedFeature
  hasSupplementary: boolean
  mousePosition: {
    x: number
    y: number
  }
}) {
  const pairTypeDesc = getPairTypeDescription(hoveredFeatureData)

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
          <div>Template length: {toLocale(hoveredFeatureData.tlen)}</div>
        ) : null}
        {pairTypeDesc ? <div>{pairTypeDesc}</div> : null}
        {hasSupplementary ? (
          <div>Has supplementary/split alignments</div>
        ) : null}
      </div>
    </BaseTooltip>
  )
}

function MismatchTooltip({
  mismatchData,
  mousePosition,
}: {
  mismatchData: FlatbushItem
  mousePosition: { x: number; y: number }
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
        <div>{getFlatbushItemLabel(mismatchData)}</div>
        <div>Position: {toLocale(mismatchData.start + 1)}</div>
      </div>
    </BaseTooltip>
  )
}

const FeatureHighlights = observer(function FeatureHighlights({
  selectedFeatureBounds,
  hoveredFeature,
}: {
  selectedFeatureBounds: {
    x: number
    y: number
    width: number
    height: number
  } | null
  hoveredFeature:
    | {
        x: number
        y: number
        width: number
        height: number
      }
    | undefined
}) {
  return (
    <>
      {selectedFeatureBounds ? (
        <div
          style={{
            position: 'absolute',
            left: selectedFeatureBounds.x,
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
            left: hoveredFeature.x,
            top: hoveredFeature.y,
            width: hoveredFeature.width,
            height: hoveredFeature.height,
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            pointerEvents: 'none',
          }}
        />
      ) : null}
    </>
  )
})

const CloudCanvases = observer(function CloudCanvases({
  model,
  width,
  height,
}: {
  width: number
  height: number
  model: LinearReadCloudDisplayModel
}) {
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
  return (
    <>
      <canvas
        data-testid={model.dataTestId}
        ref={cb}
        style={{
          width,
          height,
          position: 'absolute',
          left: 0,
          top: 0,
        }}
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
    </>
  )
})

const Cloud = observer(function Cloud({
  model,
}: {
  model: LinearReadCloudDisplayModel
}) {
  const view = getContainingView(model) as LGV
  const width = Math.round(view.dynamicBlocks.totalWidthPx)
  const height = model.drawCloud ? model.height : model.layoutHeight
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredFeature, setHoveredFeature] = useState<{
    x: number
    y: number
    width: number
    height: number
  }>()
  const [hoveredFeatureData, setHoveredFeatureData] = useState<ReducedFeature>()
  const [hoveredHasSupplementary, setHoveredHasSupplementary] = useState(false)
  const [hoveredMismatchData, setHoveredMismatchData] = useState<FlatbushItem>()
  const [mousePosition, setMousePosition] = useState<{
    x: number
    y: number
  }>()

  // Convert flatbush data to Flatbush instance
  const flatbushIndex = useMemo(() => {
    return model.featureLayout ? Flatbush.from(model.featureLayout.data) : null
  }, [model.featureLayout])

  // Convert mismatch flatbush data to Flatbush instance
  const mismatchFlatbushIndex = useMemo(() => {
    return model.mismatchLayout
      ? Flatbush.from(model.mismatchLayout.data)
      : null
  }, [model.mismatchLayout])

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

  const getFeatureUnderMouse = useCallback(
    (event: React.MouseEvent) => {
      if (!containerRef.current || !flatbushIndex) {
        return { feature: undefined, position: undefined }
      }

      const rect = containerRef.current.getBoundingClientRect()
      const offsetX = event.clientX - rect.left
      const offsetY = event.clientY - rect.top

      const results = flatbushIndex.search(
        offsetX,
        offsetY,
        offsetX + 1,
        offsetY + 1,
      )

      if (results.length > 0) {
        const featureIndex = results[0]!
        const feature = model.featuresForFlatbush[featureIndex]
        return { feature, position: { x: event.clientX, y: event.clientY } }
      }

      return { feature: undefined, position: undefined }
    },
    [containerRef, flatbushIndex, model.featuresForFlatbush],
  )

  const getMismatchUnderMouse = useCallback(
    (event: React.MouseEvent) => {
      if (!containerRef.current || !mismatchFlatbushIndex) {
        return undefined
      }

      const rect = containerRef.current.getBoundingClientRect()
      const offsetX = event.clientX - rect.left
      const offsetY = event.clientY - rect.top

      const results = mismatchFlatbushIndex.search(
        offsetX,
        offsetY,
        offsetX + 1,
        offsetY + 1,
      )

      if (results.length > 0) {
        const mismatchIndex = results[0]!
        return model.mismatchItems[mismatchIndex]
      }

      return undefined
    },
    [containerRef, mismatchFlatbushIndex, model.mismatchItems],
  )

  const onMouseMove = useCallback(
    (event: React.MouseEvent) => {
      // Check for mismatch first (higher priority for small targets)
      const mismatch = getMismatchUnderMouse(event)
      if (mismatch) {
        setHoveredMismatchData(mismatch)
        setHoveredFeature(undefined)
        setHoveredFeatureData(undefined)
        setHoveredHasSupplementary(false)
        setMousePosition({ x: event.clientX, y: event.clientY })
        return
      }

      // Fall back to feature hover
      const { feature, position } = getFeatureUnderMouse(event)
      setHoveredMismatchData(undefined)

      if (feature) {
        setHoveredFeature({
          x: feature.chainMinX,
          y: feature.y1,
          width: feature.chainMaxX - feature.chainMinX,
          height: feature.y2 - feature.y1,
        })
        setHoveredFeatureData(feature.data)
        setHoveredHasSupplementary(feature.hasSupplementary)
        setMousePosition(position)
      } else {
        setHoveredFeature(undefined)
        setHoveredFeatureData(undefined)
        setHoveredHasSupplementary(false)
        setMousePosition(undefined)
      }
    },
    [getMismatchUnderMouse, getFeatureUnderMouse],
  )

  const onMouseLeave = useCallback(() => {
    setHoveredFeature(undefined)
    setHoveredFeatureData(undefined)
    setHoveredHasSupplementary(false)
    setHoveredMismatchData(undefined)
    setMousePosition(undefined)
  }, [])

  const onClick = useCallback(
    (event: React.MouseEvent) => {
      const mismatch = getMismatchUnderMouse(event)
      if (mismatch) {
        const session = getSession(model)
        const regions = view.dynamicBlocks.contentBlocks
        const refName = regions[0]?.refName || ''
        const { feature } = getFeatureUnderMouse(event)
        const sourceRead = feature?.data.name
        if (isSessionModelWithWidgets(session)) {
          const featureWidget = session.addWidget(
            'BaseFeatureWidget',
            'baseFeature',
            {
              featureData: flatbushItemToFeatureData(
                mismatch,
                refName,
                sourceRead,
              ),
              view,
              track: getContainingTrack(model),
            },
          )
          session.showWidget(featureWidget)
        }
        return
      }

      const { feature } = getFeatureUnderMouse(event)
      if (feature) {
        model.selectFeature(feature.chain)
        model.setSelectedFeatureId(feature.chainId)
      } else {
        model.setSelectedFeatureId(undefined)
      }
    },
    [getMismatchUnderMouse, getFeatureUnderMouse, model, view],
  )

  const hasHover = hoveredMismatchData || hoveredFeatureData

  // note: the position absolute below avoids scrollbar from appearing on track
  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width,
        height,
        cursor: hasHover ? 'pointer' : undefined,
      }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      <CloudCanvases model={model} width={width} height={height} />
      <FeatureHighlights
        selectedFeatureBounds={selectedFeatureBounds}
        hoveredFeature={hoveredFeature}
      />
      {model.drawCloud && model.cloudTicks ? (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 50,
            pointerEvents: 'none',
            height: model.cloudTicks.height,
            width: 60,
            zIndex: 100,
          }}
        >
          <g transform="translate(55, 0)">
            <CloudYScaleBar model={model} orientation="left" />
          </g>
        </svg>
      ) : null}
      {hoveredMismatchData && mousePosition ? (
        <MismatchTooltip
          mismatchData={hoveredMismatchData}
          mousePosition={mousePosition}
        />
      ) : hoveredFeatureData && mousePosition ? (
        <FeatureTooltip
          hoveredFeatureData={hoveredFeatureData}
          hasSupplementary={hoveredHasSupplementary}
          mousePosition={mousePosition}
        />
      ) : null}
    </div>
  )
})

const LinearReadCloudReactComponent = observer(
  function LinearReadCloudReactComponent({
    model,
  }: {
    model: LinearReadCloudDisplayModel
  }) {
    return (
      <BaseDisplayComponent model={model}>
        <Cloud model={model} />
      </BaseDisplayComponent>
    )
  },
)
export default LinearReadCloudReactComponent
