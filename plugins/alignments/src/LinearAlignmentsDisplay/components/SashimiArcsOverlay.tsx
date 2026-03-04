import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { YSCALEBAR_LABEL_OFFSET } from '../model.ts'
import { formatSashimiTooltip } from './alignmentComponentUtils.ts'
import { openSashimiWidget } from './openFeatureWidget.ts'

import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

function getArcColor(strand: number) {
  if (strand === 1) {
    return 'rgba(255,170,170,0.7)'
  }
  if (strand === -1) {
    return 'rgba(160,160,255,0.7)'
  }
  return 'rgba(200,200,200,0.7)'
}

const SashimiArcsOverlay = observer(function SashimiArcsOverlay({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const view = getContainingView(model) as LinearGenomeViewModel
  const { showSashimiArcs, showCoverage, coverageHeight, rpcDataMap } = model
  const { initialized, offsetPx, visibleRegions } = view

  const effectiveHeight = coverageHeight - YSCALEBAR_LABEL_OFFSET

  if (!showSashimiArcs || !showCoverage || !initialized) {
    return null
  }

  const baseline = effectiveHeight * 0.9
  const peak = effectiveHeight * 0.1

  const paths: { d: string; stroke: string; strokeWidth: number; start: number; end: number; refName: string; score: number; strand: number }[] = []

  for (const [, rpcData] of rpcDataMap) {
    const { sashimiX1, sashimiX2, sashimiCounts, sashimiColorTypes, numSashimiArcs, regionStart } = rpcData

    if (numSashimiArcs === 0) {
      continue
    }

    let refName = ''
    for (const r of visibleRegions) {
      if (rpcDataMap.get(r.regionNumber) === rpcData) {
        refName = r.refName
        break
      }
    }

    for (let i = 0; i < numSashimiArcs; i++) {
      const startBp = regionStart + sashimiX1[i]!
      const endBp = regionStart + sashimiX2[i]!
      const count = sashimiCounts[i]!
      const strand = sashimiColorTypes[i] === 0 ? 1 : -1
      const startPxResult = view.bpToPx({ refName, coord: startBp })
      const endPxResult = view.bpToPx({ refName, coord: endBp })
      if (startPxResult === undefined || endPxResult === undefined) {
        continue
      }
      const left = startPxResult.offsetPx - offsetPx
      const right = endPxResult.offsetPx - offsetPx
      paths.push({
        d: `M ${left} ${baseline} C ${left} ${peak}, ${right} ${peak}, ${right} ${baseline}`,
        stroke: getArcColor(strand),
        strokeWidth: Math.log(count + 1),
        start: startBp,
        end: endBp,
        refName,
        score: count,
        strand,
      })
    }
  }

  paths.sort((a, b) => a.score - b.score)

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
          style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
          onMouseEnter={e => {
            ;(e.currentTarget as SVGPathElement).setAttribute(
              'stroke-width',
              String(p.strokeWidth + 2),
            )
            model.setMouseoverExtraInformation(
              formatSashimiTooltip({
                start: p.start,
                end: p.end,
                score: p.score,
                strand: p.strand,
                refName: p.refName,
              }),
            )
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as SVGPathElement).setAttribute(
              'stroke-width',
              String(p.strokeWidth),
            )
            model.clearMouseoverState()
          }}
          onClick={() => {
            openSashimiWidget(model, p)
          }}
        />
      ))}
    </svg>
  )
})

export default SashimiArcsOverlay
