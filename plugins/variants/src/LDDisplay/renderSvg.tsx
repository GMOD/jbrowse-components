import {
  lookupColorRamp,
  lookupColorRampCSS,
} from '@jbrowse/core/gpu/canvas2dUtils'
import { getContainingView, max } from '@jbrowse/core/util'
import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'
import { when } from 'mobx'

import { LDSVGColorLegend } from './components/LDColorLegend.tsx'
import LinesConnectingMatrixToGenomicPosition from './components/LinesConnectingMatrixToGenomicPosition.tsx'
import VariantLabels from './components/VariantLabels.tsx'
import Wrapper from './components/Wrapper.tsx'
import { generateLDColorRamp } from './components/ldColorRamp.ts'
import RecombinationTrack from '../shared/components/RecombinationTrack.tsx'
import RecombinationYScaleBar from '../shared/components/RecombinationYScaleBar.tsx'

import type { SharedLDModel } from './shared.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

function computeT(ldVal: number, signedLD: boolean) {
  const t = signedLD ? (ldVal + 1) / 2 : ldVal
  return Math.max(0, Math.min(1, t))
}

export async function renderSvg(
  self: SharedLDModel,
  opts: ExportSvgDisplayOptions,
) {
  const view = getContainingView(self) as LGV
  await when(() => self.rpcData != null || !!self.error || self.regionTooLarge)
  const { rpcData } = self
  const height = opts.overrideHeight ?? self.height

  const {
    ldMetric,
    showLegend,
    showRecombination,
    lineZoneHeight,
    useGenomicPositions,
    signedLD,
  } = self

  if (!rpcData || rpcData.numCells === 0) {
    return null
  }

  const { ldValues, boundaries, yScalar } = rpcData
  const n = boundaries.length - 1
  const visibleWidth = view.width
  const ramp = generateLDColorRamp(rpcData.metric, rpcData.signedLD)
  const rasterize = opts.rasterizeLayers
  const triangleHeight = height - lineZoneHeight

  let matrixEl: React.ReactNode

  if (rasterize) {
    const scale = 2
    const canvas =
      opts.createCanvas?.(
        Math.round(visibleWidth * scale),
        Math.round(triangleHeight * scale),
      ) ?? document.createElement('canvas')
    canvas.width = Math.round(visibleWidth * scale)
    canvas.height = Math.round(triangleHeight * scale)
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(scale, scale)
      ctx.save()
      ctx.scale(1, yScalar)
      ctx.rotate(-Math.PI / 4)

      let k = 0
      for (let i = 1; i < n; i++) {
        const py = boundaries[i]!
        const ch = boundaries[i + 1]! - py
        for (let j = 0; j < i; j++) {
          const px = boundaries[j]!
          const cw = boundaries[j + 1]! - px
          const t = computeT(ldValues[k++]!, signedLD)
          ctx.fillStyle = lookupColorRampCSS(ramp, t)
          ctx.fillRect(px, py, cw, ch)
        }
      }
      ctx.restore()
    }
    matrixEl = (
      <image
        x={0}
        y={0}
        width={visibleWidth}
        height={triangleHeight}
        xlinkHref={canvas.toDataURL('image/png')}
      />
    )
  } else {
    const SQRT2_INV = 0.7071067811865476
    const ctx = new SvgCanvas()

    let k = 0
    for (let i = 1; i < n; i++) {
      const py = boundaries[i]!
      const ch = boundaries[i + 1]! - py
      for (let j = 0; j < i; j++) {
        const px = boundaries[j]!
        const cw = boundaries[j + 1]! - px
        const t = computeT(ldValues[k++]!, signedLD)
        const { r, g, b, a } = lookupColorRamp(ramp, t)

        ctx.fillStyle = `rgb(${r},${g},${b})`
        ctx.globalAlpha = a
        ctx.beginPath()
        let first = true
        for (const [cx, cy] of [
          [px, py],
          [px + cw, py],
          [px + cw, py + ch],
          [px, py + ch],
        ] as const) {
          const rx = (cx + cy) * SQRT2_INV
          const ry = (-cx + cy) * SQRT2_INV * yScalar
          if (first) {
            ctx.moveTo(rx, ry)
            first = false
          } else {
            ctx.lineTo(rx, ry)
          }
        }
        ctx.closePath()
        ctx.fill()
      }
    }
    matrixEl = <g dangerouslySetInnerHTML={{ __html: ctx.getSerializedSvg() }} />
  }

  const clipId = `clip-${self.id}-svg`
  const recombTrackHeight = lineZoneHeight / 2
  const recombTrackYOffset = lineZoneHeight / 2

  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={visibleWidth} height={height} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <g transform={`translate(0 ${lineZoneHeight})`}>{matrixEl}</g>
        {useGenomicPositions ? (
          <Wrapper model={self} exportSVG>
            <VariantLabels model={self} />
          </Wrapper>
        ) : (
          <LinesConnectingMatrixToGenomicPosition model={self} exportSVG />
        )}
        {showRecombination && rpcData.recombination ? (
          <g transform={`translate(0 ${recombTrackYOffset})`}>
            <RecombinationTrack
              recombination={rpcData.recombination}
              width={visibleWidth}
              height={recombTrackHeight}
              exportSVG
              useGenomicPositions={useGenomicPositions}
              regionStart={view.dynamicBlocks.contentBlocks[0]?.start}
              bpPerPx={view.bpPerPx}
            />
            <RecombinationYScaleBar
              height={recombTrackHeight}
              maxValue={max(rpcData.recombination.values, 0.1)}
              exportSVG
            />
          </g>
        ) : null}
      </g>
      {showLegend ? (
        <LDSVGColorLegend
          ldMetric={ldMetric}
          width={visibleWidth}
          signedLD={signedLD}
        />
      ) : null}
    </>
  )
}
