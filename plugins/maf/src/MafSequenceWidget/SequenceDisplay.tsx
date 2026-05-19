import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import LabelsCanvas from './LabelsCanvas.tsx'
import SequenceCanvas from './SequenceCanvas.tsx'
import SequenceTooltip from './SequenceTooltip.tsx'
import { buildColToGenomePos, findRefSampleIndex } from './colToGenomePos.ts'
import { CHAR_WIDTH, ROW_HEIGHT } from './constants.ts'

import type { MafSequenceWidgetModel } from './stateModelFactory.ts'

const DEFAULT_LABEL_WIDTH = 150
const MIN_LABEL_WIDTH = 50
const MAX_LABEL_WIDTH = 400

const useStyles = makeStyles()(theme => ({
  container: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    maxHeight: 400,
    width: '100%',
    backgroundColor: theme.palette.background.paper,
    display: 'flex',
    overflow: 'hidden',
  },
  labelsWrapper: {
    flexShrink: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  resizeHandle: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 4,
    height: '100%',
    cursor: 'col-resize',
    backgroundColor: theme.palette.divider,
    '&:hover': {
      backgroundColor: theme.palette.primary.main,
    },
  },
  sequenceWrapper: {
    flexGrow: 1,
    minWidth: 0,
    overflow: 'auto',
  },
  sequenceInner: {
    position: 'relative',
  },
}))

interface SequenceDisplayProps {
  model: MafSequenceWidgetModel
  sequences: string[]
  colorBackground: boolean
  showSampleNames: boolean
}

const SequenceDisplay = observer(function SequenceDisplay({
  model,
  sequences,
  colorBackground,
  showSampleNames,
}: SequenceDisplayProps) {
  const { classes } = useStyles()
  const seqWrapperRef = useRef<HTMLDivElement>(null)
  const { samples, regions } = model

  const [scrollTop, setScrollTop] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [containerHeight, setContainerHeight] = useState(400)
  const [containerWidth, setContainerWidth] = useState(800)
  const [labelWidth, setLabelWidth] = useState(DEFAULT_LABEL_WIDTH)
  const [hoveredCol, setHoveredCol] = useState<number>()
  const [hoveredRow, setHoveredRow] = useState<number>()
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>()

  const seqLength = sequences[0]?.length ?? 0
  const totalSeqWidth = seqLength * CHAR_WIDTH
  const totalHeight = samples ? samples.length * ROW_HEIGHT : 0

  const colToGenomePos = useMemo(() => {
    if (!regions) {
      return []
    }
    const region = regions[0]
    if (!region) {
      return []
    }

    const refIdx = findRefSampleIndex(samples, region.assemblyName)
    const refSequence = sequences[refIdx] || ''
    return buildColToGenomePos(refSequence, region.start)
  }, [sequences, regions, samples])

  useEffect(() => {
    const seqWrapper = seqWrapperRef.current
    if (!seqWrapper) {
      return
    }
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { height, width } = entry.contentRect
        if (height > 0) {
          setContainerHeight(height)
        }
        if (width > 0) {
          setContainerWidth(width)
        }
      }
    })
    resizeObserver.observe(seqWrapper)
    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  // Handle resize drag
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startWidth = labelWidth

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX
        const newWidth = Math.min(
          MAX_LABEL_WIDTH,
          Math.max(MIN_LABEL_WIDTH, startWidth + delta),
        )
        setLabelWidth(newWidth)
      }

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [labelWidth],
  )

  const handleHover = useCallback(
    (
      col: number | undefined,
      row: number | undefined,
      clientX: number,
      clientY: number,
    ) => {
      if (!regions) {
        return
      }

      setHoveredCol(col)
      setHoveredRow(row)
      setTooltipPos({ x: clientX, y: clientY })

      if (col !== undefined) {
        const genomicPos = colToGenomePos[col]
        const region = regions[0]
        if (genomicPos !== undefined && region) {
          model.setHoverHighlight({
            refName: region.refName,
            start: genomicPos,
            end: genomicPos + 1,
            assemblyName: region.assemblyName,
          })
        } else {
          model.setHoverHighlight(undefined)
        }
      } else {
        model.setHoverHighlight(undefined)
      }
    },
    [colToGenomePos, model, regions],
  )

  const handleLeave = useCallback(() => {
    setHoveredCol(undefined)
    setHoveredRow(undefined)
    setTooltipPos(undefined)
    model.setHoverHighlight(undefined)
  }, [model])

  if (!samples || !regions || sequences.length === 0) {
    return <div>No sequence data</div>
  }

  const hoveredSample =
    hoveredRow !== undefined ? samples[hoveredRow] : undefined
  const hoveredChar =
    hoveredRow !== undefined && hoveredCol !== undefined
      ? sequences[hoveredRow]?.[hoveredCol]
      : undefined
  const genomicPos =
    hoveredCol !== undefined ? colToGenomePos[hoveredCol] : undefined

  return (
    <div className={classes.container}>
      {showSampleNames && (
        <div
          className={classes.labelsWrapper}
          style={{ width: labelWidth, height: containerHeight }}
        >
          <LabelsCanvas
            samples={samples}
            labelWidth={labelWidth}
            scrollTop={scrollTop}
            containerHeight={containerHeight}
          />
          <div
            className={classes.resizeHandle}
            onMouseDown={handleResizeMouseDown}
          />
        </div>
      )}
      <div
        ref={seqWrapperRef}
        className={classes.sequenceWrapper}
        onScroll={e => {
          setScrollTop(e.currentTarget.scrollTop)
          setScrollLeft(e.currentTarget.scrollLeft)
        }}
      >
        <div
          className={classes.sequenceInner}
          style={{ width: totalSeqWidth, height: totalHeight }}
        >
          <SequenceCanvas
            samples={samples}
            sequences={sequences}
            colorBackground={colorBackground}
            hoveredCol={hoveredCol}
            scrollTop={scrollTop}
            scrollLeft={scrollLeft}
            containerHeight={containerHeight}
            containerWidth={containerWidth}
            onHover={handleHover}
            onLeave={handleLeave}
          />
        </div>
      </div>
      {tooltipPos && hoveredSample && (
        <SequenceTooltip
          x={tooltipPos.x}
          y={tooltipPos.y}
          sample={hoveredSample}
          base={hoveredChar}
          genomicPos={genomicPos}
        />
      )}
    </div>
  )
})

export default SequenceDisplay
