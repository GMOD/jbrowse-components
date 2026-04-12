import { useEffect, useMemo, useRef } from 'react'

import { ErrorBar } from '@jbrowse/core/ui'
import {
  codonTable,
  complement,
  getContainingView,
  revcom,
} from '@jbrowse/core/util'
import { Alert, useTheme } from '@mui/material'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import LoadingOverlay from './LoadingOverlay.tsx'
import {
  buildColorPalette,
  frameShiftBounds,
  startsSet,
  stopsSet,
} from './sequenceGeometry.ts'

import type {
  LinearReferenceSequenceDisplayModel,
  SequenceRegionData,
} from '../model.ts'
import type { ColorPalette } from './sequenceGeometry.ts'
import type { Frame } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { Theme } from '@mui/material'

type RGB = readonly [number, number, number]

const BORDER_COLOR = 'rgb(85,85,85)'

function contrastColor(rgb: RGB) {
  const lum = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000
  return lum < 128 ? '#fff' : '#000'
}

interface TextColors {
  baseContrast: Map<string, string>
  startContrast: string
  stopContrast: string
}

function buildTextColors(palette: ColorPalette, theme: Theme): TextColors {
  const baseContrast = new Map<string, string>()
  for (const [base, rgb] of palette.baseColors) {
    baseContrast.set(base, contrastColor(rgb))
  }
  return {
    baseContrast,
    startContrast: theme.palette.getContrastText(theme.palette.startCodon),
    stopContrast: theme.palette.getContrastText(theme.palette.stopCodon),
  }
}

function rgbStyle([r, g, b]: RGB) {
  return `rgb(${r},${g},${b})`
}

function setLetterFont(ctx: CanvasRenderingContext2D, rowHeight: number) {
  ctx.font = `${Math.min(rowHeight - 2, 14)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
}

function drawBaseRow(
  ctx: CanvasRenderingContext2D,
  seq: string,
  seqStart: number,
  y: number,
  rowHeight: number,
  bpPerPx: number,
  offsetPx: number,
  showBorders: boolean,
  sequenceType: string,
  palette: ColorPalette,
  textColors: TextColors,
  visStartBp: number,
  visEndBp: number,
) {
  const w = 1 / bpPerPx
  const iStart = Math.max(0, Math.floor(visStartBp - seqStart))
  const iEnd = Math.min(seq.length, Math.ceil(visEndBp - seqStart))

  if (showBorders) {
    setLetterFont(ctx, rowHeight)
    ctx.strokeStyle = BORDER_COLOR
    ctx.lineWidth = 1
  }

  for (let i = iStart; i < iEnd; i++) {
    const letter = seq[i]!
    const upper = letter.toUpperCase()
    const rgb = palette.baseColors.get(upper) ?? ([170, 170, 170] as const)
    const x = (seqStart + i) / bpPerPx - offsetPx

    ctx.fillStyle = rgbStyle(rgb)
    ctx.fillRect(x, y, w, rowHeight)

    if (showBorders) {
      ctx.strokeRect(x, y, w, rowHeight)
      ctx.fillStyle =
        sequenceType === 'dna'
          ? (textColors.baseContrast.get(upper) ?? '#000')
          : '#000'
      ctx.fillText(letter, x + w / 2, y + rowHeight / 2)
    }
  }
}

function drawTranslationRow(
  ctx: CanvasRenderingContext2D,
  seq: string,
  seqStart: number,
  frame: Frame,
  y: number,
  rowHeight: number,
  bpPerPx: number,
  offsetPx: number,
  reversed: boolean,
  showBorders: boolean,
  palette: ColorPalette,
  textColors: TextColors,
  visStartBp: number,
  visEndBp: number,
) {
  const bgColor = palette.frameColors.get(frame)!
  const bgStyle = rgbStyle(bgColor)
  const { frameShift, sliceEnd } = frameShiftBounds(seq, seqStart, frame)

  const codonWidth = 3 / bpPerPx

  const clipStart = Math.max(0, Math.floor(visStartBp - seqStart) - 3)
  const clipEnd = Math.min(seq.length, Math.ceil(visEndBp - seqStart) + 3)
  const rawStart = Math.max(frameShift, clipStart)
  const codonAlignedStart = rawStart - ((rawStart - frameShift) % 3)

  if (!showBorders) {
    const x0 = seqStart / bpPerPx - offsetPx
    const x1 = (seqStart + seq.length) / bpPerPx - offsetPx
    ctx.fillStyle = bgStyle
    ctx.fillRect(x0, y, x1 - x0, rowHeight)
  } else {
    if (frameShift > 0) {
      ctx.fillStyle = bgStyle
      ctx.fillRect(
        seqStart / bpPerPx - offsetPx,
        y,
        frameShift / bpPerPx,
        rowHeight,
      )
    }
    const trailing = seq.length - sliceEnd
    if (trailing > 0) {
      ctx.fillStyle = bgStyle
      ctx.fillRect(
        (seqStart + sliceEnd) / bpPerPx - offsetPx,
        y,
        trailing / bpPerPx,
        rowHeight,
      )
    }
  }

  if (showBorders) {
    setLetterFont(ctx, rowHeight)
    ctx.strokeStyle = BORDER_COLOR
    ctx.lineWidth = 1
  }

  for (let i = codonAlignedStart; i < Math.min(sliceEnd, clipEnd); i += 3) {
    const codon = seq.slice(i, i + 3)
    const normalizedCodon = reversed ? revcom(codon) : codon
    const upperCodon = normalizedCodon.toUpperCase()
    const x = (seqStart + i) / bpPerPx - offsetPx

    const isStart = startsSet.has(upperCodon)
    const isStop = stopsSet.has(upperCodon)

    if (showBorders) {
      const color = isStart
        ? palette.startColor
        : isStop
          ? palette.stopColor
          : bgColor
      ctx.fillStyle = rgbStyle(color)
      ctx.fillRect(x, y, codonWidth, rowHeight)
      ctx.strokeRect(x, y, codonWidth, rowHeight)
    } else if (isStart) {
      ctx.fillStyle = rgbStyle(palette.startColor)
      ctx.fillRect(x, y, codonWidth, rowHeight)
    } else if (isStop) {
      ctx.fillStyle = rgbStyle(palette.stopColor)
      ctx.fillRect(x, y, codonWidth, rowHeight)
    }

    if (showBorders) {
      const letter = codonTable[normalizedCodon] || ''
      ctx.fillStyle = isStart
        ? textColors.startContrast
        : isStop
          ? textColors.stopContrast
          : '#000'
      ctx.fillText(letter, x + codonWidth / 2, y + rowHeight / 2)
    }
  }
}

function drawSequence(
  ctx: CanvasRenderingContext2D,
  sequenceData: Map<number, SequenceRegionData>,
  view: LinearGenomeViewModel,
  showForward: boolean,
  showReverse: boolean,
  showTranslation: boolean,
  sequenceType: string,
  rowHeight: number,
  palette: ColorPalette,
  textColors: TextColors,
) {
  const { bpPerPx, offsetPx, trackWidthPx } = view
  const showBorders = 1 / bpPerPx >= 12
  const visStartBp = offsetPx * bpPerPx
  const visEndBp = (offsetPx + trackWidthPx) * bpPerPx

  const forwardFrames: Frame[] = showTranslation && showForward ? [3, 2, 1] : []
  const reverseFrames: Frame[] =
    showTranslation && showReverse ? [-1, -2, -3] : []

  for (const [regionNum, data] of sequenceData) {
    const reversed = view.displayedRegions[regionNum]?.reversed ?? false
    const [topFrames, bottomFrames] = reversed
      ? [reverseFrames.toReversed(), forwardFrames.toReversed()]
      : [forwardFrames, reverseFrames]

    let currentY = 0

    for (const frame of topFrames) {
      drawTranslationRow(
        ctx,
        data.seq,
        data.start,
        frame,
        currentY,
        rowHeight,
        bpPerPx,
        offsetPx,
        reversed,
        showBorders,
        palette,
        textColors,
        visStartBp,
        visEndBp,
      )
      currentY += rowHeight
    }

    if (showForward) {
      const fwdSeq = reversed ? complement(data.seq) : data.seq
      drawBaseRow(
        ctx,
        fwdSeq,
        data.start,
        currentY,
        rowHeight,
        bpPerPx,
        offsetPx,
        showBorders,
        sequenceType,
        palette,
        textColors,
        visStartBp,
        visEndBp,
      )
      currentY += rowHeight
    }

    if (showReverse) {
      const revSeq = reversed ? data.seq : complement(data.seq)
      drawBaseRow(
        ctx,
        revSeq,
        data.start,
        currentY,
        rowHeight,
        bpPerPx,
        offsetPx,
        showBorders,
        sequenceType,
        palette,
        textColors,
        visStartBp,
        visEndBp,
      )
      currentY += rowHeight
    }

    for (const frame of bottomFrames) {
      drawTranslationRow(
        ctx,
        data.seq,
        data.start,
        frame,
        currentY,
        rowHeight,
        bpPerPx,
        offsetPx,
        !reversed,
        showBorders,
        palette,
        textColors,
        visStartBp,
        visEndBp,
      )
      currentY += rowHeight
    }
  }
}

const SequenceDisplayComponent = observer(function SequenceDisplayComponent({
  model,
}: {
  model: LinearReferenceSequenceDisplayModel
}) {
  const { height, error, showLoading } = model
  const view = getContainingView(model) as LinearGenomeViewModel
  const theme = useTheme()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const palette = useMemo(() => buildColorPalette(theme), [theme])
  const textColors = useMemo(
    () => buildTextColors(palette, theme),
    [palette, theme],
  )

  useEffect(() => {
    return autorun(function sequenceDrawAutorun() {
      const canvas = canvasRef.current
      if (!canvas || model.sequenceData.size === 0) {
        return
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        return
      }

      const cssWidth = view.trackWidthPx
      const cssHeight = model.height
      const dpr = devicePixelRatio || 1
      const bufW = Math.round(cssWidth * dpr)
      const bufH = Math.round(cssHeight * dpr)
      if (canvas.width !== bufW || canvas.height !== bufH) {
        canvas.width = bufW
        canvas.height = bufH
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, cssWidth, cssHeight)

      drawSequence(
        ctx,
        model.sequenceData,
        view,
        model.showForwardActual,
        model.showReverseActual,
        model.showTranslationActual,
        model.sequenceType,
        model.rowHeight,
        palette,
        textColors,
      )
    })
  }, [model, view, palette, textColors])

  const zoomedOut = view.bpPerPx > 10

  return (
    <div
      data-testid="sequence-display"
      style={{ position: 'relative', width: '100%', height }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: zoomedOut || showLoading ? 'none' : 'block',
        }}
      />
      {zoomedOut ? (
        <Alert severity="info">Zoom in to see sequence</Alert>
      ) : (
        <LoadingOverlay isVisible={showLoading} />
      )}
      {error ? (
        <ErrorBar
          error={error}
          onRetry={() => {
            model.reload()
          }}
        />
      ) : null}
    </div>
  )
})

export default SequenceDisplayComponent
