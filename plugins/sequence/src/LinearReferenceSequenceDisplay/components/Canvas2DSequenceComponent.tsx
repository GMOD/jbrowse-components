import { useEffect, useMemo, useRef } from 'react'

import { ErrorBar } from '@jbrowse/core/ui'
import {
  complement,
  defaultStarts,
  defaultStops,
  getContainingView,
  revcom,
} from '@jbrowse/core/util'
import { Alert } from '@mui/material'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import LoadingOverlay from './LoadingOverlay.tsx'
import {
  buildColorPalette,
  buildSequenceGeometry,
  codonTable,
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

function contrastColor(rgb: RGB) {
  const lum = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000
  return lum < 128 ? '#fff' : '#000'
}

interface TextColors {
  baseContrastColors: Map<string, string>
  startCodonContrast: string
  stopCodonContrast: string
}

function buildTextColors(palette: ColorPalette, theme: Theme): TextColors {
  const baseContrastColors = new Map<string, string>()
  for (const [base, rgb] of palette.baseColors) {
    baseContrastColors.set(base, contrastColor(rgb))
  }
  return {
    baseContrastColors,
    startCodonContrast: theme.palette.getContrastText(theme.palette.startCodon),
    stopCodonContrast: theme.palette.getContrastText(theme.palette.stopCodon),
  }
}

function drawRects(
  ctx: CanvasRenderingContext2D,
  rectBuf: Float32Array,
  colorBuf: Uint8Array,
  instanceCount: number,
  basePx: number,
  bpPerPx: number,
  cssWidth: number,
  showBorders: boolean,
) {
  for (let i = 0; i < instanceCount; i++) {
    const ri = i * 4
    const xBp = rectBuf[ri]!
    const yPx = rectBuf[ri + 1]!
    const widthBp = rectBuf[ri + 2]!
    const heightPx = rectBuf[ri + 3]!

    const widthPx = Math.max(widthBp / bpPerPx, 1)
    const xPx = xBp / bpPerPx + basePx

    if (xPx + widthPx < 0 || xPx > cssWidth) {
      continue
    }

    const r = colorBuf[ri]!
    const g = colorBuf[ri + 1]!
    const b = colorBuf[ri + 2]!
    const hasBorder = colorBuf[ri + 3]! > 254

    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.fillRect(xPx, yPx, widthPx, heightPx)

    if (showBorders && hasBorder) {
      ctx.strokeStyle = 'rgb(85,85,85)'
      ctx.lineWidth = 1
      ctx.strokeRect(xPx, yPx, widthPx, heightPx)
    }
  }
}

function drawBaseLetters(
  ctx: CanvasRenderingContext2D,
  seq: string,
  seqStart: number,
  y: number,
  rowHeight: number,
  bpPerPx: number,
  offsetPx: number,
  sequenceType: string,
  textColors: TextColors,
  visibleStartBp: number,
  visibleEndBp: number,
) {
  const w = 1 / bpPerPx
  const fontSize = Math.min(rowHeight - 2, 14)
  ctx.font = `${fontSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const iStart = Math.max(0, Math.floor(visibleStartBp - seqStart))
  const iEnd = Math.min(seq.length, Math.ceil(visibleEndBp - seqStart))

  for (let i = iStart; i < iEnd; i++) {
    const letter = seq[i]!
    const x = (seqStart + i) / bpPerPx - offsetPx
    const cx = x + w / 2
    const cy = y + rowHeight / 2

    ctx.fillStyle =
      sequenceType === 'dna'
        ? (textColors.baseContrastColors.get(letter.toUpperCase()) ?? '#000')
        : '#000'
    ctx.fillText(letter, cx, cy)
  }
}

function drawTranslationLetters(
  ctx: CanvasRenderingContext2D,
  seq: string,
  seqStart: number,
  frame: Frame,
  y: number,
  rowHeight: number,
  bpPerPx: number,
  offsetPx: number,
  reversed: boolean,
  textColors: TextColors,
  visibleStartBp: number,
  visibleEndBp: number,
) {
  const normalizedFrame = Math.abs(frame) - 1
  const seqFrame = seqStart % 3
  const frameShift = (normalizedFrame - seqFrame + 3) % 3
  const frameShiftAdjustedSeqLength = seq.length - frameShift
  const multipleOfThreeLength =
    frameShiftAdjustedSeqLength - (frameShiftAdjustedSeqLength % 3)
  const sliceEnd = frameShift + multipleOfThreeLength

  const codonWidth = 3 / bpPerPx
  const fontSize = Math.min(rowHeight - 2, 14)
  ctx.font = `${fontSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const clipStart = Math.max(0, Math.floor(visibleStartBp - seqStart) - 3)
  const clipEnd = Math.min(seq.length, Math.ceil(visibleEndBp - seqStart) + 3)
  const rawStart = Math.max(frameShift, clipStart)
  const codonAlignedStart = rawStart - ((rawStart - frameShift) % 3)

  for (let i = codonAlignedStart; i < Math.min(sliceEnd, clipEnd); i += 3) {
    const codon = seq.slice(i, i + 3)
    const normalizedCodon = reversed ? revcom(codon) : codon
    const letter = codonTable[normalizedCodon] || ''
    const upperCodon = normalizedCodon.toUpperCase()

    const x = (seqStart + i) / bpPerPx - offsetPx
    const cx = x + codonWidth / 2
    const cy = y + rowHeight / 2

    const isStart = defaultStarts.includes(upperCodon)
    const isStop = defaultStops.includes(upperCodon)
    ctx.fillStyle = isStart
      ? textColors.startCodonContrast
      : isStop
        ? textColors.stopCodonContrast
        : '#000'
    ctx.fillText(letter, cx, cy)
  }
}

function drawLetters(
  ctx: CanvasRenderingContext2D,
  sequenceData: Map<number, SequenceRegionData>,
  view: LinearGenomeViewModel,
  showForward: boolean,
  showReverseActual: boolean,
  showTranslationActual: boolean,
  sequenceType: string,
  rowHeight: number,
  textColors: TextColors,
) {
  const { bpPerPx, offsetPx, trackWidthPx } = view
  const visibleStartBp = offsetPx * bpPerPx
  const visibleEndBp = (offsetPx + trackWidthPx) * bpPerPx

  const forwardFrames: Frame[] =
    showTranslationActual && showForward ? [3, 2, 1] : []
  const reverseFrames: Frame[] =
    showTranslationActual && showReverseActual ? [-1, -2, -3] : []

  for (const [regionNum, data] of sequenceData) {
    const reversed = view.displayedRegions[regionNum]?.reversed ?? false
    const [topFrames, bottomFrames] = reversed
      ? [reverseFrames.toReversed(), forwardFrames.toReversed()]
      : [forwardFrames, reverseFrames]

    let currentY = 0

    for (const frame of topFrames) {
      drawTranslationLetters(
        ctx,
        data.seq,
        data.start,
        frame,
        currentY,
        rowHeight,
        bpPerPx,
        offsetPx,
        reversed,
        textColors,
        visibleStartBp,
        visibleEndBp,
      )
      currentY += rowHeight
    }

    if (showForward) {
      const fwdSeq = reversed ? complement(data.seq) : data.seq
      drawBaseLetters(
        ctx,
        fwdSeq,
        data.start,
        currentY,
        rowHeight,
        bpPerPx,
        offsetPx,
        sequenceType,
        textColors,
        visibleStartBp,
        visibleEndBp,
      )
      currentY += rowHeight
    }

    if (showReverseActual) {
      const revSeq = reversed ? data.seq : complement(data.seq)
      drawBaseLetters(
        ctx,
        revSeq,
        data.start,
        currentY,
        rowHeight,
        bpPerPx,
        offsetPx,
        sequenceType,
        textColors,
        visibleStartBp,
        visibleEndBp,
      )
      currentY += rowHeight
    }

    for (const frame of bottomFrames) {
      drawTranslationLetters(
        ctx,
        data.seq,
        data.start,
        frame,
        currentY,
        rowHeight,
        bpPerPx,
        offsetPx,
        !reversed,
        textColors,
        visibleStartBp,
        visibleEndBp,
      )
      currentY += rowHeight
    }
  }
}

const Canvas2DSequenceComponent = observer(function Canvas2DSequenceComponent({
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
      if (!canvas) {
        return
      }
      const data = model.sequenceData
      const regionEntries = [...data.entries()]
      if (regionEntries.length === 0) {
        return
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        return
      }

      const cssWidth = view.trackWidthPx
      const cssHeight = model.height
      const { bpPerPx } = view

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

      const showBorders = 1 / bpPerPx >= 12
      const showLetters = 1 / bpPerPx >= 12
      const {
        showForwardActual,
        showReverseActual,
        showTranslationActual,
        sequenceType,
        rowHeight,
      } = model

      const settings = {
        showForward: showForwardActual,
        showReverse: showReverseActual,
        showTranslation: showTranslationActual,
        sequenceType,
        rowHeight,
        colorByCDS: false,
        showBorders,
      }

      const baseBp = Math.min(...regionEntries.map(([, d]) => d.start))
      const basePx = baseBp / bpPerPx - view.offsetPx

      for (const [regionNum, regionData] of regionEntries) {
        const reversed = view.displayedRegions[regionNum]?.reversed ?? false
        const geom = buildSequenceGeometry(
          regionData,
          settings,
          reversed,
          palette,
          baseBp,
        )
        drawRects(
          ctx,
          geom.rectBuf,
          geom.colorBuf,
          geom.instanceCount,
          basePx,
          bpPerPx,
          cssWidth,
          showBorders,
        )
      }

      if (showLetters) {
        drawLetters(
          ctx,
          data,
          view,
          showForwardActual,
          showReverseActual,
          showTranslationActual,
          sequenceType,
          rowHeight,
          textColors,
        )
      }
    })
  }, [model, view, palette, textColors])

  const zoomedOut = view.bpPerPx > 10

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
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

export default Canvas2DSequenceComponent

function useTheme() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@mui/material').useTheme() as Theme
}
