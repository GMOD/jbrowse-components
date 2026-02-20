import { useCallback, useRef, useState } from 'react'

import { observer } from 'mobx-react'

import { YSCALEBAR_LABEL_OFFSET } from '../model.ts'
import CoverageYScaleBar from './CoverageYScaleBar.tsx'
import LoadingOverlay from './LoadingOverlay.tsx'
import VisibleLabelsOverlay from './VisibleLabelsOverlay.tsx'
import { formatFeatureTooltip } from './alignmentComponentUtils.ts'
import { useAlignmentsBase } from './useAlignmentsBase.ts'

import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'

const WebGLPileupComponent = observer(function WebGLPileupComponent({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const base = useAlignmentsBase(model)
  const {
    canvasRef,
    resizeHandleHovered,
    setResizeHandleHovered,
    width,
    contrastMap,
    handleMouseDown,
    handleMouseUp,
    handleMouseLeave,
    handleResizeMouseDown,
    handleContextMenu,
    processMouseMove,
    processClick,
  } = base

  const { height, showCoverage, coverageHeight, showArcs, arcsHeight } = model

  const [debugInfo, setDebugInfo] = useState({ x: 0, y: 0, adjY: 0, row: 0, topOff: 0 })
  const [arcsResizeHovered, setArcsResizeHovered] = useState(false)
  const arcsResizeDragRef = useRef({
    isDragging: false,
    startY: 0,
    startHeight: 0,
  })

  function handleArcsResizeMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    arcsResizeDragRef.current = {
      isDragging: true,
      startY: e.clientY,
      startHeight: arcsHeight,
    }

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!arcsResizeDragRef.current.isDragging) {
        return
      }
      const deltaY = moveEvent.clientY - arcsResizeDragRef.current.startY
      const newHeight = Math.max(
        20,
        arcsResizeDragRef.current.startHeight + deltaY,
      )
      model.setArcsHeight(newHeight)
    }

    const onMouseUp = () => {
      arcsResizeDragRef.current.isDragging = false
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  function handleCanvasMouseMove(e: React.MouseEvent) {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (rect) {
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const topOff = (showCoverage ? coverageHeight : 0) + (showArcs ? arcsHeight : 0)
      const fh = model.featureHeightSetting + model.featureSpacing
      const adjY = cy + model.currentRangeY[0] - topOff
      setDebugInfo({ x: Math.round(cx), y: Math.round(cy), adjY: Math.round(adjY), row: Math.floor(adjY / fh), topOff })
    }
    processMouseMove(
      e,
      hit => {
        model.setFeatureIdUnderMouse(hit.id)
        if (model.highlightedFeatureIndex !== hit.index) {
          model.setHighlightedFeatureIndex(hit.index)
        }
        if (model.highlightedChainIndices.length > 0) {
          model.setHighlightedChainIndices([])
        }
        model.setMouseoverExtraInformation(
          formatFeatureTooltip(hit.id, id => model.getFeatureInfoById(id)),
        )
      },
      () => {
        model.clearMouseoverState()
      },
    )
  }

  function handleClick(e: React.MouseEvent) {
    processClick(
      e,
      hit => {
        model.setSelectedFeatureIndex(hit.index)
        model.selectFeatureById(hit.id)
      },
      () => {
        model.clearSelection()
      },
    )
  }

  const arcsTop = showCoverage ? coverageHeight : 0

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          display: 'block',
          width,
          height,
          cursor:
            model.featureIdUnderMouse || model.overCigarItem
              ? 'pointer'
              : 'default',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      />

      <VisibleLabelsOverlay
        labels={model.visibleLabels}
        width={width}
        height={height}
        contrastMap={contrastMap}
      />

      {model.coverageTicks ? (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: model.scalebarOverlapLeft,
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

      {showArcs ? (
        <div
          onMouseDown={handleArcsResizeMouseDown}
          onMouseEnter={() => {
            setArcsResizeHovered(true)
          }}
          onMouseLeave={() => {
            setArcsResizeHovered(false)
          }}
          style={{
            position: 'absolute',
            top: arcsTop + arcsHeight - YSCALEBAR_LABEL_OFFSET,
            left: 0,
            right: 0,
            height: YSCALEBAR_LABEL_OFFSET,
            cursor: 'row-resize',
            background: arcsResizeHovered ? 'rgba(0,0,0,0.1)' : 'transparent',
            zIndex: 10,
          }}
          title="Drag to resize arcs area"
        />
      ) : null}

      <LoadingOverlay
        statusMessage={model.statusMessage}
        isVisible={model.showLoading}
      />

      {/* Debug overlay - remove after fixing mouseover */}
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        background: 'rgba(0,0,0,0.7)',
        color: '#0f0',
        fontSize: 10,
        fontFamily: 'monospace',
        padding: 4,
        pointerEvents: 'none',
        zIndex: 100,
      }}>
        cx={debugInfo.x} cy={debugInfo.y} adjY={debugInfo.adjY} row={debugInfo.row} topOff={debugInfo.topOff}
        <br />
        hlIdx={model.highlightedFeatureIndex} feat={model.featureIdUnderMouse ?? 'none'}
      </div>
      <div style={{
        position: 'absolute',
        left: 0,
        top: debugInfo.row * (model.featureHeightSetting + model.featureSpacing) - model.currentRangeY[0] + debugInfo.topOff,
        width: '100%',
        height: model.featureHeightSetting,
        background: 'rgba(255,0,0,0.15)',
        borderTop: '1px solid red',
        pointerEvents: 'none',
        zIndex: 100,
      }} />
    </div>
  )
})

export default WebGLPileupComponent
