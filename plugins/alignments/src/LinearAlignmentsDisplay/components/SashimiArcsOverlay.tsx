import { useEffect, useMemo, useRef } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { YSCALEBAR_LABEL_OFFSET } from '../model.ts'
import { formatSashimiTooltip } from './alignmentComponentUtils.ts'

import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface ArcData {
  path: string
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

const SashimiArcsOverlay = observer(function SashimiArcsOverlay({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const view = getContainingView(model) as LinearGenomeViewModel
  const svgRef = useRef<SVGSVGElement>(null)

  const {
    showSashimiArcs,
    showCoverage,
    coverageHeight,
    rpcDataMap,
  } = model

  const effectiveHeight = coverageHeight - YSCALEBAR_LABEL_OFFSET

  const arcs = useMemo(() => {
    if (!showSashimiArcs || !showCoverage || !view.initialized) {
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

      const regions = view.visibleRegions
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

        const startPxResult = view.bpToPx({
          refName,
          coord: startBp,
        })
        const endPxResult = view.bpToPx({
          refName,
          coord: endBp,
        })
        if (startPxResult === undefined || endPxResult === undefined) {
          continue
        }

        const left = startPxResult.offsetPx - view.offsetPx
        const right = endPxResult.offsetPx - view.offsetPx

        const baseline = effectiveHeight * 0.9
        const peak = effectiveHeight * 0.1

        result.push({
          path: `M ${left} ${baseline} C ${left} ${peak}, ${right} ${peak}, ${right} ${baseline}`,
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
    view.initialized,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    view.initialized ? view.bpPerPx : 0,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    view.initialized ? view.offsetPx : 0,
    rpcDataMap,
    effectiveHeight,
  ])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) {
      return
    }
    while (svg.firstChild) {
      svg.firstChild.remove()
    }
    for (const arc of arcs) {
      const path = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path',
      )
      path.setAttribute('d', arc.path)
      path.setAttribute('stroke', arc.stroke)
      path.setAttribute('stroke-width', String(arc.strokeWidth))
      path.setAttribute('fill', 'none')
      path.setAttribute('pointer-events', 'stroke')
      path.setAttribute('cursor', 'pointer')
      const origWidth = arc.strokeWidth
      path.addEventListener('mouseenter', () => {
        path.setAttribute('stroke-width', String(origWidth + 2))
        model.setMouseoverExtraInformation(
          formatSashimiTooltip({
            start: arc.start,
            end: arc.end,
            score: arc.score,
            strand: arc.strand,
            refName: arc.refName,
          }),
        )
      })
      path.addEventListener('mouseleave', () => {
        path.setAttribute('stroke-width', String(origWidth))
        model.clearMouseoverState()
      })
      svg.append(path)
    }
  }, [arcs, model])

  if (!showSashimiArcs || !showCoverage || !view.initialized) {
    return null
  }

  return (
    <svg
      ref={svgRef}
      style={{
        position: 'absolute',
        top: YSCALEBAR_LABEL_OFFSET,
        left: 0,
        pointerEvents: 'none',
        height: effectiveHeight,
        width: view.width,
        overflow: 'visible',
      }}
    />
  )
})

export default SashimiArcsOverlay
