import { readConfObject } from '@jbrowse/core/configuration'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { computeRowFrame, groupSpanOnRow } from '../layoutMultiWay.ts'

import type { MultiWayGroup } from '../layoutMultiWay.ts'
import type { MultiWaySyntenyDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type Span = readonly [number, number]

// how far past the viewport an anchor glyph still counts as visible, so the
// row frames don't churn the moment a gene's edge crosses the screen edge
const VISIBLE_PAD_PX = 50

function ribbonPath(s1: Span, y1: number, s2: Span, y2: number) {
  const ym = (y1 + y2) / 2
  return `M ${s1[0]} ${y1} C ${s1[0]} ${ym}, ${s2[0]} ${ym}, ${s2[0]} ${y2} L ${s2[1]} ${y2} C ${s2[1]} ${ym}, ${s1[1]} ${ym}, ${s1[1]} ${y1} Z`
}

const MultiWayRows = observer(function MultiWayRows({
  model,
  exportSVG,
}: {
  model: MultiWaySyntenyDisplayModel
  exportSVG?: boolean
}) {
  const view = getContainingView(model) as LinearGenomeViewModel
  const { assemblyManager } = getSession(model)
  const anchorAssemblyName = view.assemblyNames[0]!
  const assembly = assemblyManager.get(anchorAssemblyName)
  if (!assembly) {
    return null
  }
  const { groups, rowAssemblies, height, ribbonColor, selectedFeatureId } =
    model
  const width = model.canvasWidth

  const anchorSpans = new Map<string, Span>()
  for (const group of groups) {
    const refName = assembly.getCanonicalRefName2(group.anchor.refName)
    const l = view.bpToPx({ refName, coord: group.anchor.start })?.offsetPx
    const r = view.bpToPx({ refName, coord: group.anchor.end })?.offsetPx
    if (l !== undefined && r !== undefined) {
      const a = l - view.offsetPx
      const b = r - view.offsetPx
      anchorSpans.set(group.key, a < b ? [a, b] : [b, a])
    }
  }
  // the lanes re-fit to what is on screen: frames derive from the groups whose
  // anchor placement is in (or near) the viewport, so panning the anchor
  // re-lays-out every other lane in its own local frame
  const visible = groups.filter(group => {
    const span = anchorSpans.get(group.key)
    return (
      span !== undefined &&
      span[1] > -VISIBLE_PAD_PX &&
      span[0] < width + VISIBLE_PAD_PX
    )
  })
  const frames = rowAssemblies.map(assemblyName =>
    computeRowFrame(visible, assemblyName),
  )

  const rowCount = rowAssemblies.length + 1
  const pitch = height / rowCount
  const glyphHeight = Math.max(3, Math.min(14, pitch * 0.35))
  const glyphTop = (rowIndex: number) =>
    rowIndex * pitch + (pitch - glyphHeight) / 2

  const spanOnRow = (group: MultiWayGroup, rowIndex: number) => {
    if (rowIndex === 0) {
      return anchorSpans.get(group.key)
    }
    const frame = frames[rowIndex - 1]
    return frame
      ? groupSpanOnRow(group, rowAssemblies[rowIndex - 1]!, frame, width)
      : undefined
  }

  const ribbons: React.ReactNode[] = []
  for (let rowIndex = 0; rowIndex < rowCount - 1; rowIndex++) {
    for (const group of visible) {
      const s1 = spanOnRow(group, rowIndex)
      const s2 = spanOnRow(group, rowIndex + 1)
      if (s1 && s2) {
        ribbons.push(
          <path
            key={`ribbon-${rowIndex}-${group.key}`}
            d={ribbonPath(
              s1,
              glyphTop(rowIndex) + glyphHeight,
              s2,
              glyphTop(rowIndex + 1),
            )}
            fill={ribbonColor}
          />,
        )
      }
    }
  }

  const glyphs: React.ReactNode[] = []
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    for (const group of visible) {
      const span = spanOnRow(group, rowIndex)
      if (span) {
        const selected = selectedFeatureId === group.feature.id()
        glyphs.push(
          <rect
            key={`glyph-${rowIndex}-${group.key}`}
            x={span[0]}
            y={glyphTop(rowIndex)}
            width={Math.max(1, span[1] - span[0])}
            height={glyphHeight}
            fill={
              selected
                ? 'red'
                : readConfObject(model.configuration, 'color', {
                    feature: group.feature,
                  })
            }
            style={{ cursor: 'pointer' }}
            onClick={() => {
              model.selectFeature(group.feature)
            }}
          >
            <title>{group.name}</title>
          </rect>,
        )
      }
    }
  }

  const labels = [anchorAssemblyName, ...rowAssemblies].map(
    (assemblyName, rowIndex) => (
      <text
        key={`label-${assemblyName}`}
        x={2}
        y={glyphTop(rowIndex) - 2}
        fontSize={10}
        fill="#555"
      >
        {assemblyName}
      </text>
    ),
  )

  const body = (
    <>
      {ribbons}
      {glyphs}
      {labels}
    </>
  )
  return exportSVG ? (
    body
  ) : (
    <svg width={width} height={height}>
      {body}
    </svg>
  )
})

export default MultiWayRows
