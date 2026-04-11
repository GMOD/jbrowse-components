import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/alignments-core'
import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { arcColorPalette } from './shaders/arcShaders.ts'
import { rgb255 } from '../colorUtils.ts'

import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const PairedArcsOverlay = observer(function PairedArcsOverlay({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const view = getContainingView(model) as LinearGenomeViewModel
  const { showArcs, pairedArcsDown, coverageHeight, arcsState } = model
  const { initialized, offsetPx, visibleRegions } = view

  if (!showArcs || pairedArcsDown || !initialized) {
    return null
  }

  const effectiveHeight = coverageHeight - YSCALEBAR_LABEL_OFFSET
  const baseline = effectiveHeight * 0.9
  const peak = effectiveHeight * 0.1

  const paths: { d: string; stroke: string; strokeWidth: number }[] = []

  for (const region of visibleRegions) {
    const arcsData = arcsState.rpcDataMap.get(region.regionNumber)
    if (!arcsData) {
      continue
    }
    const { refName } = region
    const { regionStart, arcX1, arcX2, arcColorTypes, arcIsArc, numArcs } =
      arcsData

    for (let i = 0; i < numArcs; i++) {
      if (!arcIsArc[i]) {
        continue
      }
      const startBp = regionStart + arcX1[i]!
      const endBp = regionStart + arcX2[i]!
      const startPxResult = view.bpToPx({ refName, coord: startBp })
      const endPxResult = view.bpToPx({ refName, coord: endBp })
      if (!startPxResult || !endPxResult) {
        continue
      }
      const left = startPxResult.offsetPx - offsetPx
      const right = endPxResult.offsetPx - offsetPx
      const colorIdx = Math.round(arcColorTypes[i]!)
      const stroke =
        colorIdx < arcColorPalette.length
          ? rgb255(arcColorPalette[colorIdx]!)
          : 'grey'

      paths.push({
        d: `M ${left} ${baseline} C ${left} ${peak}, ${right} ${peak}, ${right} ${baseline}`,
        stroke,
        strokeWidth: arcsState.lineWidth,
      })
    }
  }

  return (
    <svg
      style={{
        position: 'absolute',
        top: YSCALEBAR_LABEL_OFFSET,
        left: 0,
        pointerEvents: 'none',
        height: effectiveHeight,
        width: view.width,
        overflow: 'visible',
      }}
    >
      {paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          stroke={p.stroke}
          strokeWidth={p.strokeWidth}
          fill="none"
        />
      ))}
    </svg>
  )
})

export default PairedArcsOverlay
