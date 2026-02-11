import { useEffect } from 'react'

import {
  FloatingLegend,
} from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import { YSCALEBAR_LABEL_OFFSET } from '../model.ts'
import CloudYScaleBar from './CloudYScaleBar.tsx'
import CoverageYScaleBar from './CoverageYScaleBar.tsx'
import LoadingOverlay from './LoadingOverlay.tsx'
import VisibleLabelsOverlay from './VisibleLabelsOverlay.tsx'
import { formatChainTooltip } from './alignmentComponentUtils.ts'
import { useAlignmentsBase } from './useAlignmentsBase.ts'

import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'

const WebGLChainComponent = observer(function WebGLChainComponent({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const base = useAlignmentsBase(model, true)
  const {
    canvasRef,
    rendererRef,
    measureRef,
    overCigarItem,
    resizeHandleHovered,
    setResizeHandleHovered,
    width,
    height,
    contrastMap,
    statusMessage,
    handleMouseDown,
    handleMouseUp,
    handleMouseLeave,
    handleResizeMouseDown,
    handleContextMenu,
    processMouseMove,
    processClick,
    doRender,
    visibleLabels,
  } = base

  const { showCoverage, coverageHeight, rpcDataMap } = model

  // Upload connecting line data for chain modes
  useEffect(() => {
    if (!rendererRef.current) {
      return
    }
    const renderer = rendererRef.current
    for (const [regionNumber, data] of rpcDataMap) {
      if (
        data.connectingLinePositions &&
        data.connectingLineYs &&
        data.connectingLineColorTypes &&
        data.numConnectingLines
      ) {
        renderer.uploadConnectingLinesForRegion(regionNumber, {
          regionStart: data.regionStart,
          connectingLinePositions: data.connectingLinePositions,
          connectingLineYs: data.connectingLineYs,
          connectingLineColorTypes: data.connectingLineColorTypes,
          numConnectingLines: data.numConnectingLines,
        })
      }
    }
    doRender()
  }, [rpcDataMap])

  function handleCanvasMouseMove(e: React.MouseEvent) {
    processMouseMove(
      e,
      (hit, resolved) => {
        model.setFeatureIdUnderMouse(hit.id)
        if (model.highlightedFeatureIndex !== hit.index) {
          model.setHighlightedFeatureIndex(hit.index)
        }
        const readName = resolved.rpcData.readNames[hit.index]
        const chainIndices = readName
          ? (model.chainIndexMap.get(readName) ?? [])
          : []
        model.setHighlightedChainIndices(chainIndices)
        model.setMouseoverExtraInformation(
          formatChainTooltip(resolved.rpcData, hit.index, resolved.refName),
        )
      },
      () => {
        model.setFeatureIdUnderMouse(undefined)
        if (model.highlightedFeatureIndex !== -1) {
          model.setHighlightedFeatureIndex(-1)
        }
        if (model.highlightedChainIndices.length > 0) {
          model.setHighlightedChainIndices([])
        }
        model.setMouseoverExtraInformation(undefined)
      },
    )
  }

  function handleClick(e: React.MouseEvent) {
    processClick(
      e,
      (hit, resolved) => {
        model.setSelectedFeatureIndex(hit.index)
        model.selectFeatureById(hit.id)
        const readName = resolved.rpcData.readNames[hit.index]
        const chainIndices = readName
          ? (model.chainIndexMap.get(readName) ?? [])
          : []
        model.setSelectedChainIndices(chainIndices)
      },
      () => {
        if (model.selectedFeatureIndex !== -1) {
          model.setSelectedFeatureIndex(-1)
        }
        if (model.selectedChainIndices.length > 0) {
          model.setSelectedChainIndices([])
        }
      },
    )
  }

  return (
    <div
      ref={measureRef}
      style={{ position: 'relative', width: '100%', height }}
    >
      <canvas
        ref={canvasRef}
        width={width ?? 800}
        height={height}
        style={{
          display: 'block',
          width: width ?? '100%',
          height,
          cursor:
            model.featureIdUnderMouse || overCigarItem ? 'pointer' : 'default',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      />

      <VisibleLabelsOverlay
        labels={visibleLabels}
        width={width}
        height={height}
        contrastMap={contrastMap}
      />

      {model.coverageTicks ? (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none',
            height: model.coverageTicks.height,
            width: 50,
          }}
        >
          <g transform="translate(45, 0)">
            <CoverageYScaleBar model={model} orientation="left" />
          </g>
        </svg>
      ) : null}

      {model.cloudTicks ? (
        <svg
          style={{
            position: 'absolute',
            top: showCoverage ? coverageHeight : 0,
            left: 0,
            pointerEvents: 'none',
            height: model.cloudTicks.height,
            width: 50,
          }}
        >
          <g transform="translate(45, 0)">
            <CloudYScaleBar model={model} orientation="left" />
          </g>
        </svg>
      ) : null}

      {model.showLegend ? <FloatingLegend items={model.legendItems} /> : null}

      {showCoverage ? (
        <div
          onMouseDown={handleResizeMouseDown}
          onMouseEnter={() => {
            setResizeHandleHovered(true)
          }}
          onMouseLeave={() => {
            setResizeHandleHovered(false)
          }}
          style={{
            position: 'absolute',
            top: coverageHeight - YSCALEBAR_LABEL_OFFSET,
            left: 0,
            right: 0,
            height: YSCALEBAR_LABEL_OFFSET,
            cursor: 'row-resize',
            background: resizeHandleHovered ? 'rgba(0,0,0,0.1)' : 'transparent',
            zIndex: 10,
          }}
          title="Drag to resize coverage track"
        />
      ) : null}

      <LoadingOverlay
        statusMessage={statusMessage}
        isVisible={model.showLoading}
      />
    </div>
  )
})

export default WebGLChainComponent
