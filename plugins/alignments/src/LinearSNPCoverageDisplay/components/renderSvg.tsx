import { getContainingView, getSession } from '@jbrowse/core/util'

import { featureToArcData } from './arcUtils.ts'

import type { Feature } from '@jbrowse/core/util'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

// Interface to avoid circular import with model.ts
interface SNPCoverageDisplayModel {
  id: string
  skipFeatures: Feature[]
  height: number
  showArcsSetting: boolean
}

const YSCALEBAR_LABEL_OFFSET = 5

function renderSashimiArcsSvg(
  self: SNPCoverageDisplayModel,
  view: LinearGenomeViewModel,
) {
  const { id, skipFeatures, height, showArcsSetting } = self

  if (!showArcsSetting || skipFeatures.length === 0) {
    return null
  }

  const { assemblyManager } = getSession(self)
  const assembly = assemblyManager.get(view.assemblyNames[0]!)
  if (!assembly) {
    return null
  }

  const effectiveHeight = height - YSCALEBAR_LABEL_OFFSET * 2
  const currentOffsetPx = view.offsetPx
  const width = view.dynamicBlocks.totalWidthPx

  // Generate arc data
  const arcs = skipFeatures
    .map(f =>
      featureToArcData(f, view, effectiveHeight, currentOffsetPx, assembly),
    )
    .filter((arc): arc is NonNullable<typeof arc> => arc !== undefined)

  if (arcs.length === 0) {
    return null
  }

  const clipId = `sashimi-arcs-clip-${id}`

  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={width} height={height} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <g transform={`translate(0, ${YSCALEBAR_LABEL_OFFSET})`}>
          {arcs.map(arc => (
            <path
              key={arc.id}
              d={arc.path}
              stroke={arc.stroke}
              strokeWidth={arc.strokeWidth}
              fill="none"
            />
          ))}
        </g>
      </g>
    </>
  )
}

export async function renderSNPCoverageSvg(
  self: SNPCoverageDisplayModel,
  opts: ExportSvgDisplayOptions,
  superRenderSvg: (opts: ExportSvgDisplayOptions) => Promise<React.ReactNode>,
) {
  const view = getContainingView(self) as LinearGenomeViewModel
  const baseRendering = await superRenderSvg(opts)
  const arcsRendering = renderSashimiArcsSvg(self, view)

  return (
    <>
      {baseRendering}
      {arcsRendering}
    </>
  )
}
