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
  const base = useAlignmentsBase(model, false)
  const {
    canvasRef,
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
    visibleLabels,
  } = base

  const { showCoverage, coverageHeight } = model

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
      hit => {
        model.setSelectedFeatureIndex(hit.index)
        model.selectFeatureById(hit.id)
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

export default WebGLPileupComponent
