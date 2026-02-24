import { getContainingView, max } from '@jbrowse/core/util'

import { LDSVGColorLegend } from './components/LDColorLegend.tsx'
import LinesConnectingMatrixToGenomicPosition from './components/LinesConnectingMatrixToGenomicPosition.tsx'
import VariantLabels from './components/VariantLabels.tsx'
import Wrapper from './components/Wrapper.tsx'
import { generateLDColorRamp } from './components/WebGLLDRenderer.ts'
import RecombinationTrack from '../shared/components/RecombinationTrack.tsx'
import RecombinationYScaleBar from '../shared/components/RecombinationYScaleBar.tsx'

import type { SharedLDModel } from './shared.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

function lookupColor(ramp: Uint8Array, t: number) {
  const idx = Math.max(0, Math.min(255, Math.round(t * 255)))
  const r = ramp[idx * 4]!
  const g = ramp[idx * 4 + 1]!
  const b = ramp[idx * 4 + 2]!
  const a = ramp[idx * 4 + 3]!
  return { rgb: `rgb(${r},${g},${b})`, opacity: a / 255 }
}

function lookupColorCSS(ramp: Uint8Array, t: number) {
  const idx = Math.max(0, Math.min(255, Math.round(t * 255)))
  const r = ramp[idx * 4]!
  const g = ramp[idx * 4 + 1]!
  const b = ramp[idx * 4 + 2]!
  const a = ramp[idx * 4 + 3]!
  return `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`
}

function computeT(ldVal: number, signedLD: boolean) {
  let t = signedLD ? (ldVal + 1) / 2 : ldVal
  return Math.max(0, Math.min(1, t))
}

export async function renderSvg(
  self: SharedLDModel,
  opts: ExportSvgDisplayOptions,
) {
  const view = getContainingView(self) as LGV
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

  const { positions, ldValues, cellSizes, numCells, yScalar } = rpcData
  const visibleWidth = view.width
  const ramp = generateLDColorRamp(rpcData.metric, rpcData.signedLD)
  const rasterize = opts?.rasterizeLayers
  const triangleHeight = height - lineZoneHeight

  let matrixEl: React.ReactNode

  if (rasterize) {
    const canvas = document.createElement('canvas')
    const scale = 2
    canvas.width = Math.round(visibleWidth * scale)
    canvas.height = Math.round(triangleHeight * scale)
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(scale, scale)
      ctx.save()
      ctx.scale(1, yScalar)
      ctx.rotate(-Math.PI / 4)

      for (let i = 0; i < numCells; i++) {
        const px = positions[i * 2]!
        const py = positions[i * 2 + 1]!
        const cw = cellSizes[i * 2]!
        const ch = cellSizes[i * 2 + 1]!
        const t = computeT(ldValues[i]!, signedLD)
        ctx.fillStyle = lookupColorCSS(ramp, t)
        ctx.fillRect(px, py, cw, ch)
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
    let content = ''

    for (let i = 0; i < numCells; i++) {
      const px = positions[i * 2]!
      const py = positions[i * 2 + 1]!
      const cw = cellSizes[i * 2]!
      const ch = cellSizes[i * 2 + 1]!
      const t = computeT(ldValues[i]!, signedLD)
      const { rgb, opacity } = lookupColor(ramp, t)

      const corners = [
        [px, py],
        [px + cw, py],
        [px + cw, py + ch],
        [px, py + ch],
      ] as const

      const pts = corners
        .map(([cx, cy]) => {
          const rx = (cx + cy) * SQRT2_INV
          const ry = (-cx + cy) * SQRT2_INV * yScalar
          return `${rx},${ry}`
        })
        .join(' ')

      content += `<polygon points="${pts}" fill="${rgb}" fill-opacity="${opacity}"/>`
    }
    matrixEl = <g dangerouslySetInnerHTML={{ __html: content }} />
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
        <g transform={`translate(0 ${lineZoneHeight})`}>
          {matrixEl}
        </g>
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
