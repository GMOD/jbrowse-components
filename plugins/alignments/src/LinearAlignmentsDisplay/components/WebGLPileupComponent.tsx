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
    arcsResizeHovered,
    setArcsResizeHovered,
    width,
    contrastMap,
    handleMouseDown,
    handleMouseUp,
    handleMouseLeave,
    handleResizeMouseDown,
    handleArcsResizeMouseDown,
    handleContextMenu,
    processMouseMove,
    processClick,
  } = base

  const {
    height,
    showCoverage,
    coverageHeight,
    showArcs,
    coverageDisplayHeight: topOffset,
  } = model

  function handleCanvasMouseMove(e: React.MouseEvent) {
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
            top: topOffset - YSCALEBAR_LABEL_OFFSET,
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
    </div>
  )
})

export default WebGLPileupComponent
