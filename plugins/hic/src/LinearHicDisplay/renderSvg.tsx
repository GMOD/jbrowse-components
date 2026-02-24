import { getContainingView } from '@jbrowse/core/util'
import { when } from 'mobx'

import { generateColorRamp } from './components/WebGLHicRenderer.ts'
import HicSVGColorLegend from './components/HicSVGColorLegend.tsx'

import type { LinearHicDisplayModel } from './model.ts'
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

function computeT(count: number, m: number, useLogScale: boolean) {
  let t: number
  if (useLogScale) {
    t = Math.log2(Math.max(count, 1)) / Math.log2(Math.max(m, 1))
  } else {
    t = count / Math.max(m, 0.001)
  }
  return Math.max(0, Math.min(1, t))
}

export async function renderSvg(
  self: LinearHicDisplayModel,
  opts: ExportSvgDisplayOptions,
) {
  const view = getContainingView(self) as LGV
  await when(() => self.rpcData != null || !!self.error || self.regionTooLarge)
  const { rpcData, useLogScale, colorScheme, showLegend } = self
  if (!rpcData || rpcData.numContacts === 0) {
    return null
  }

  const { positions, counts, numContacts, maxScore, binWidth, yScalar } =
    rpcData
  const height = opts.overrideHeight ?? self.height
  const visibleWidth = view.width

  const m = useLogScale ? maxScore : maxScore / 20
  const ramp = generateColorRamp(colorScheme)
  const rasterize = opts?.rasterizeLayers
  const clipId = `clip-${self.id}-svg`

  let matrixEl: React.ReactNode

  if (rasterize) {
    const scale = 2
    const canvas = opts.createCanvas?.(Math.round(visibleWidth * scale), Math.round(height * scale)) ?? document.createElement('canvas')
    canvas.width = Math.round(visibleWidth * scale)
    canvas.height = Math.round(height * scale)
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(scale, scale)
      ctx.save()
      ctx.scale(1, yScalar)
      ctx.rotate(-Math.PI / 4)

      for (let i = 0; i < numContacts; i++) {
        const px = positions[i * 2]!
        const py = positions[i * 2 + 1]!
        const count = counts[i]!
        const t = computeT(count, m, useLogScale)
        ctx.fillStyle = lookupColorCSS(ramp, t)
        ctx.fillRect(px, py, binWidth, binWidth)
      }
      ctx.restore()
    }
    matrixEl = (
      <image
        x={0}
        y={0}
        width={visibleWidth}
        height={height}
        xlinkHref={canvas.toDataURL('image/png')}
      />
    )
  } else {
    const SQRT2_INV = 0.7071067811865476
    let content = ''

    for (let i = 0; i < numContacts; i++) {
      const px = positions[i * 2]!
      const py = positions[i * 2 + 1]!
      const count = counts[i]!
      const t = computeT(count, m, useLogScale)
      const { rgb, opacity } = lookupColor(ramp, t)

      const corners = [
        [px, py],
        [px + binWidth, py],
        [px + binWidth, py + binWidth],
        [px, py + binWidth],
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

  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={visibleWidth} height={height} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {matrixEl}
      </g>
      {showLegend && maxScore > 0 ? (
        <HicSVGColorLegend
          maxScore={maxScore}
          colorScheme={colorScheme}
          useLogScale={useLogScale}
          width={visibleWidth}
          legendAreaWidth={opts.legendWidth}
        />
      ) : null}
    </>
  )
}
