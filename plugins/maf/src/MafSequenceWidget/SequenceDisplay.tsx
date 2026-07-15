import { useCallback, useState } from 'react'

import { ResizeHandle } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import useMeasure from '@jbrowse/core/util/useMeasure'
import { alpha } from '@mui/material'
import { observer } from 'mobx-react'

import LabelsCanvas from './LabelsCanvas.tsx'
import SequenceCanvas from './SequenceCanvas.tsx'
import SequenceTooltip from './SequenceTooltip.tsx'
import { CHAR_WIDTH, ROW_HEIGHT } from './constants.ts'
import { colToHighlight, genomePosAt } from './genomePos.ts'

import type { MafSequenceWidgetModel } from './stateModelFactory.ts'

interface HoverState {
  col?: number
  row?: number
  x: number
  y: number
}

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
  },
  sequenceWrapper: {
    flexGrow: 1,
    minWidth: 0,
    overflow: 'auto',
  },
  sequenceInner: {
    position: 'relative',
  },
  hoverColumn: {
    position: 'absolute',
    top: 0,
    width: CHAR_WIDTH,
    pointerEvents: 'none',
    background: alpha(theme.palette.highlight.main, 0.5),
  },
}))

interface SequenceDisplayProps {
  model: MafSequenceWidgetModel
  sequences: string[]
  // Display-column → genomic position from the worker; `-1` marks inserted
  // columns that have no reference base. Authoritative, so the widget never
  // guesses which row is the reference.
  colToGenomePos: number[]
  colorBackground: boolean
  showSampleNames: boolean
}

const SequenceDisplay = observer(function SequenceDisplay({
  model,
  sequences,
  colToGenomePos,
  colorBackground,
  showSampleNames,
}: SequenceDisplayProps) {
  const { classes } = useStyles()
  const [seqWrapperRef, { width, height }] = useMeasure()
  const { samples, regions } = model

  const [scrollTop, setScrollTop] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [labelWidth, setLabelWidth] = useState(DEFAULT_LABEL_WIDTH)
  const [hover, setHover] = useState<HoverState>()

  const seqLength = sequences[0]?.length ?? 0
  const totalSeqWidth = seqLength * CHAR_WIDTH
  const totalHeight = samples ? samples.length * ROW_HEIGHT : 0

  const handleHover = useCallback(
    (
      col: number | undefined,
      row: number | undefined,
      clientX: number,
      clientY: number,
    ) => {
      if (regions) {
        setHover({ col, row, x: clientX, y: clientY })
        model.setHoverHighlight(colToHighlight(col, colToGenomePos, regions[0]))
      }
    },
    [colToGenomePos, model, regions],
  )

  const handleLeave = useCallback(() => {
    setHover(undefined)
    model.setHoverHighlight(undefined)
  }, [model])

  if (!samples || !regions || sequences.length === 0) {
    return <div>No sequence data</div>
  }

  const hoveredSample =
    hover?.row !== undefined ? samples[hover.row] : undefined
  const hoveredChar =
    hover?.row !== undefined && hover.col !== undefined
      ? sequences[hover.row]?.[hover.col]
      : undefined
  // `-1` sentinel (inserted column with no reference base) → undefined, which
  // SequenceTooltip renders as "Insertion (not in reference)".
  const genomicPos = genomePosAt(colToGenomePos, hover?.col)

  return (
    <div className={classes.container}>
      {showSampleNames && height !== undefined && (
        <div
          className={classes.labelsWrapper}
          style={{ width: labelWidth, height }}
        >
          <LabelsCanvas
            samples={samples}
            labelWidth={labelWidth}
            scrollTop={scrollTop}
            containerHeight={height}
          />
          <ResizeHandle
            bar
            vertical
            className={classes.resizeHandle}
            onDrag={d => {
              setLabelWidth(w =>
                Math.min(MAX_LABEL_WIDTH, Math.max(MIN_LABEL_WIDTH, w + d)),
              )
            }}
          />
        </div>
      )}
      {/* The wrapper renders unconditionally so `useMeasure` can size it; the
          canvas paints only once measured, avoiding a guessed-size first frame. */}
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
          {width !== undefined && height !== undefined ? (
            <SequenceCanvas
              samples={samples}
              sequences={sequences}
              colorBackground={colorBackground}
              scrollTop={scrollTop}
              scrollLeft={scrollLeft}
              containerHeight={height}
              containerWidth={width}
              onHover={handleHover}
              onLeave={handleLeave}
            />
          ) : null}
          {hover?.col !== undefined ? (
            <div
              className={classes.hoverColumn}
              style={{ left: hover.col * CHAR_WIDTH, height: totalHeight }}
            />
          ) : null}
        </div>
      </div>
      {hover && hoveredSample && (
        <SequenceTooltip
          x={hover.x}
          y={hover.y}
          sample={hoveredSample}
          base={hoveredChar}
          genomicPos={genomicPos}
        />
      )}
    </div>
  )
})

export default SequenceDisplay
