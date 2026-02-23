import { useEffect } from 'react'

import { ErrorBar } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  FloatingLegend,
  TooLargeMessage,
} from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import { YSCALEBAR_LABEL_OFFSET } from '../model.ts'
import CoverageYScaleBar from './CoverageYScaleBar.tsx'
import LoadingOverlay from './LoadingOverlay.tsx'
import VisibleLabelsOverlay from './VisibleLabelsOverlay.tsx'
import {
  formatChainTooltip,
  formatFeatureTooltip,
} from './alignmentComponentUtils.ts'
import { useAlignmentsBase } from './useAlignmentsBase.ts'

import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'

const useStyles = makeStyles()({
  scrollbarTrack: {
    position: 'absolute' as const,
    right: 0,
    width: 12,
    cursor: 'default',
    zIndex: 10,
    '&:hover > *': {
      background: 'rgba(0,0,0,0.55)',
    },
  },
  scrollbarThumb: {
    position: 'absolute' as const,
    right: 2,
    width: 6,
    borderRadius: 3,
    background: 'rgba(0,0,0,0.3)',
    pointerEvents: 'none' as const,
  },
})

const WebGLPileupComponent = observer(function WebGLPileupComponent({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const { error, regionTooLarge, height } = model

  if (error || regionTooLarge) {
    return (
      <div style={{ position: 'relative', width: '100%', height }}>
        {error ? (
          <ErrorBar
            error={error}
            onRetry={() => {
              model.reload()
            }}
          />
        ) : (
          <TooLargeMessage model={model} />
        )}
      </div>
    )
  }

  return <WebGLPileupInner model={model} />
})

const WebGLPileupInner = observer(function WebGLPileupInner({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const { classes } = useStyles()
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
    isChainMode,
    coverageDisplayHeight: topOffset,
  } = model

  function handleCanvasMouseMove(e: React.MouseEvent) {
    processMouseMove(
      e,
      (hit, resolved) => {
        model.setFeatureIdUnderMouse(hit.id)
        if (model.highlightedFeatureIndex !== hit.index) {
          model.setHighlightedFeatureIndex(hit.index)
        }
        if (isChainMode) {
          const chainIdx = resolved.rpcData.readChainIndices?.[hit.index]
          const chainIndices =
            chainIdx !== undefined
              ? (model.chainIndexMap.get(chainIdx) ?? [])
              : []
          model.setHighlightedChainIndices(chainIndices)
          model.setMouseoverExtraInformation(
            formatChainTooltip(resolved.rpcData, hit.index, resolved.refName),
          )
        } else {
          if (model.highlightedChainIndices.length > 0) {
            model.setHighlightedChainIndices([])
          }
          model.setMouseoverExtraInformation(
            formatFeatureTooltip(hit.id, id => model.getFeatureInfoById(id)),
          )
        }
      },
      () => {
        model.clearMouseoverState()
      },
    )
  }

  function handleClick(e: React.MouseEvent) {
    processClick(
      e,
      (hit, resolved) => {
        model.setSelectedFeatureIndex(hit.index)
        model.selectFeatureById(hit.id)
        if (isChainMode) {
          const chainIdx = resolved.rpcData.readChainIndices?.[hit.index]
          const chainIndices =
            chainIdx !== undefined
              ? (model.chainIndexMap.get(chainIdx) ?? [])
              : []
          model.setSelectedChainIndices(chainIndices)
        }
      },
      () => {
        model.clearSelection()
      },
    )
  }

  const view = getContainingView(model) as { scrollZoom?: boolean }
  const { scrollZoom } = view
  const {
    scrollableHeight,
    pileupViewportHeight,
    currentRangeY,
    setCurrentRangeY,
  } = model

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const handler = (e: WheelEvent) => {
      if (scrollZoom && !e.shiftKey) {
        return
      }
      if (scrollableHeight <= 0) {
        return
      }
      let dy = e.deltaY
      if (e.deltaMode === 1) {
        dy *= 40
      } else if (e.deltaMode === 2) {
        dy *= pileupViewportHeight
      }
      const curScroll = currentRangeY[0]
      const newScroll = Math.max(0, Math.min(scrollableHeight, curScroll + dy))
      if (newScroll !== curScroll) {
        e.preventDefault()
        setCurrentRangeY([newScroll, newScroll + pileupViewportHeight])
      }
    }
    canvas.addEventListener('wheel', handler, { passive: false })
    return () => {
      canvas.removeEventListener('wheel', handler)
    }
  }, [
    canvasRef,
    scrollZoom,
    scrollableHeight,
    pileupViewportHeight,
    currentRangeY,
    setCurrentRangeY,
  ])

  const hasOverflow = model.scrollableHeight > 0
  const trackHeight = model.pileupViewportHeight
  const thumbHeight = hasOverflow
    ? Math.max(20, trackHeight * (trackHeight / model.totalPileupHeight))
    : 0
  const thumbTop = hasOverflow
    ? topOffset +
      (model.currentRangeY[0] / model.scrollableHeight) *
        (trackHeight - thumbHeight)
    : 0

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <canvas
        ref={canvasRef}
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

      {hasOverflow ? (
        <div
          className={classes.scrollbarTrack}
          style={{ top: topOffset, height: trackHeight }}
          onMouseDown={e => {
            e.preventDefault()
            e.stopPropagation()
            const startY = e.clientY
            const startScroll = model.currentRangeY[0]
            const scrollRange = model.scrollableHeight
            const usableTrack = trackHeight - thumbHeight

            const onMouseMove = (me: MouseEvent) => {
              const dy = me.clientY - startY
              const scrollDelta =
                usableTrack > 0 ? (dy / usableTrack) * scrollRange : 0
              const next = Math.max(
                0,
                Math.min(scrollRange, startScroll + scrollDelta),
              )
              model.setCurrentRangeY([next, next + model.pileupViewportHeight])
            }
            const onMouseUp = () => {
              document.removeEventListener('mousemove', onMouseMove)
              document.removeEventListener('mouseup', onMouseUp)
            }
            document.addEventListener('mousemove', onMouseMove)
            document.addEventListener('mouseup', onMouseUp)
          }}
        >
          <div
            className={classes.scrollbarThumb}
            style={{ top: thumbTop - topOffset, height: thumbHeight }}
          />
        </div>
      ) : null}
    </div>
  )
})

export default WebGLPileupComponent
