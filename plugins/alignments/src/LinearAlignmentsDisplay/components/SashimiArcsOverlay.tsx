import { useMemo, useState } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { YSCALEBAR_LABEL_OFFSET } from '../model.ts'
import { formatSashimiTooltip } from './alignmentComponentUtils.ts'

import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface ArcData {
  startOffsetPx: number
  endOffsetPx: number
  stroke: string
  strokeWidth: number
  start: number
  end: number
  refName: string
  score: number
  strand: number
}

function getArcColor(strand: number) {
  if (strand === 1) {
    return 'rgba(255,170,170,0.7)'
  }
  if (strand === -1) {
    return 'rgba(160,160,255,0.7)'
  }
  return 'rgba(200,200,200,0.7)'
}

function ArcPath({
  arc,
  offsetPx,
  baseline,
  peak,
  model,
}: {
  arc: ArcData
  offsetPx: number
  baseline: number
  peak: number
  model: LinearAlignmentsDisplayModel
}) {
  const [hovered, setHovered] = useState(false)
  const left = arc.startOffsetPx - offsetPx
  const right = arc.endOffsetPx - offsetPx
  return (
    <path
      d={`M ${left} ${baseline} C ${left} ${peak}, ${right} ${peak}, ${right} ${baseline}`}
      stroke={arc.stroke}
      strokeWidth={hovered ? arc.strokeWidth + 2 : arc.strokeWidth}
      fill="none"
      pointerEvents="stroke"
      cursor="pointer"
      onMouseEnter={() => {
        setHovered(true)
        model.setMouseoverExtraInformation(
          formatSashimiTooltip({
            start: arc.start,
            end: arc.end,
            score: arc.score,
            strand: arc.strand,
            refName: arc.refName,
          }),
        )
      }}
      onMouseLeave={() => {
        setHovered(false)
        model.clearMouseoverState()
      }}
    />
  )
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

  const arcs = useMemo(() => {
    if (!showSashimiArcs || !showCoverage || !initialized) {
      return []
    }

    const result: ArcData[] = []
    for (const [, rpcData] of rpcDataMap) {
      const {
        sashimiX1,
        sashimiX2,
        sashimiCounts,
        sashimiColorTypes,
        numSashimiArcs,
        regionStart,
      } = rpcData

      if (numSashimiArcs === 0) {
        continue
      }

      const regions = visibleRegions
      let refName = ''
      for (const r of regions) {
        const data = rpcDataMap.get(r.regionNumber)
        if (data === rpcData) {
          refName = r.refName
          break
        }
      }

      for (let i = 0; i < numSashimiArcs; i++) {
        const x1Offset = sashimiX1[i]!
        const x2Offset = sashimiX2[i]!
        const startBp = regionStart + x1Offset
        const endBp = regionStart + x2Offset
        const count = sashimiCounts[i]!
        const colorType = sashimiColorTypes[i]!
        const strand = colorType === 0 ? 1 : -1

        const startPxResult = view.bpToPx({ refName, coord: startBp })
        const endPxResult = view.bpToPx({ refName, coord: endBp })
        if (startPxResult === undefined || endPxResult === undefined) {
          continue
        }

        result.push({
          startOffsetPx: startPxResult.offsetPx,
          endOffsetPx: endPxResult.offsetPx,
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

    return result.sort((a, b) => a.score - b.score)
  }, [
    showSashimiArcs,
    showCoverage,
    initialized,
    view,
    visibleRegions,
    rpcDataMap,
  ])

  if (!showSashimiArcs || !showCoverage || !initialized) {
    return null
  }

  const baseline = effectiveHeight * 0.9
  const peak = effectiveHeight * 0.1

  return (
    <svg
      style={{
        position: 'absolute',
        top: YSCALEBAR_LABEL_OFFSET,
        left: 0,
        pointerEvents: 'auto',
        height: effectiveHeight,
        width: view.width,
        overflow: 'visible',
      }}
    >
      {arcs.map((arc, i) => (
        <ArcPath
          key={i}
          arc={arc}
          offsetPx={offsetPx}
          baseline={baseline}
          peak={peak}
          model={model}
        />
      ))}
    </svg>
  )
})

export default SashimiArcsOverlay
