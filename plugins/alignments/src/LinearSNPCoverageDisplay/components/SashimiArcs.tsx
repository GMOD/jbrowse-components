import { useEffect, useMemo, useRef, useState } from 'react'

import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { getContainingView, getSession, notEmpty } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import ArcTooltipContents from './ArcTooltipContents'
import { featureToArcData } from './arcUtils'

import type { ArcData } from './arcUtils'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const YSCALEBAR_LABEL_OFFSET = 5
const SVGNS = 'http://www.w3.org/2000/svg'

export interface ArcDisplayModel {
  showArcsSetting: boolean
  height: number
  skipFeatures: Feature[]
}

const SashimiArcs = observer(function ({ model }: { model: ArcDisplayModel }) {
  const { showArcsSetting, height, skipFeatures } = model
  const view = getContainingView(model) as LinearGenomeViewModel
  const { assemblyManager } = getSession(model)
  const [hoverInfo, setHoverInfo] = useState<{
    arc: ArcData
    x: number
    y: number
  } | null>(null)

  const svgRef = useRef<SVGSVGElement>(null)
  const arcMapRef = useRef<Map<string, ArcData>>(new Map())

  const width = Math.round(view.dynamicBlocks.totalWidthPx)
  const effectiveHeight = height - YSCALEBAR_LABEL_OFFSET * 2

  const { arcs, drawnAtBpPerPx, drawnAtOffsetPx } = useMemo(() => {
    const currentOffsetPx = view.offsetPx
    const assembly = assemblyManager.get(view.assemblyNames[0]!)
    return {
      arcs: assembly
        ? skipFeatures
            .map(f =>
              featureToArcData(
                f,
                view,
                effectiveHeight,
                currentOffsetPx,
                assembly,
              ),
            )
            .filter(notEmpty)
        : [],
      drawnAtBpPerPx: view.bpPerPx,
      drawnAtOffsetPx: currentOffsetPx,
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipFeatures, view.bpPerPx, effectiveHeight])

  // Direct DOM manipulation - bypasses React VDOM for path elements
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) {
      return
    }

    // Clear existing paths
    while (svg.firstChild) {
      svg.firstChild.remove()
    }

    // Build lookup map
    const arcMap = new Map<string, ArcData>()

    // Event handlers (shared across all paths)
    const handleMouseEnter = (event: MouseEvent) => {
      const target = event.currentTarget as SVGPathElement
      const id = target.dataset.id
      if (id) {
        const arc = arcMap.get(id)
        if (arc) {
          setHoverInfo({ arc, x: event.clientX, y: event.clientY })
        }
      }
    }
    const handleMouseLeave = () => {
      setHoverInfo(null)
    }

    // Create paths directly in DOM
    for (const arc of arcs) {
      arcMap.set(arc.id, arc)
      const path = document.createElementNS(SVGNS, 'path')
      path.setAttribute('d', arc.path)
      path.setAttribute('stroke', arc.stroke)
      path.setAttribute('stroke-width', String(arc.strokeWidth))
      path.setAttribute('fill', 'none')
      path.setAttribute('pointer-events', 'stroke')
      path.setAttribute('cursor', 'pointer')
      path.dataset.id = arc.id
      path.addEventListener('mouseenter', handleMouseEnter)
      path.addEventListener('mouseleave', handleMouseLeave)
      svg.append(path)
    }

    arcMapRef.current = arcMap

    // Cleanup
    return () => {
      while (svg.firstChild) {
        const child = svg.firstChild as SVGPathElement
        child.removeEventListener('mouseenter', handleMouseEnter)
        child.removeEventListener('mouseleave', handleMouseLeave)
        child.remove()
      }
    }
  }, [arcs])

  if (
    !showArcsSetting ||
    !view.initialized ||
    drawnAtBpPerPx !== view.bpPerPx
  ) {
    return null
  }

  const left = drawnAtOffsetPx - view.offsetPx

  return (
    <>
      <svg
        ref={svgRef}
        style={{
          position: 'absolute',
          top: YSCALEBAR_LABEL_OFFSET,
          left,
          pointerEvents: 'none',
          height: effectiveHeight,
          width,
        }}
      />
      {hoverInfo ? (
        <BaseTooltip clientPoint={{ x: hoverInfo.x + 5, y: hoverInfo.y }}>
          <ArcTooltipContents arc={hoverInfo.arc} />
        </BaseTooltip>
      ) : null}
    </>
  )
})

export default SashimiArcs
