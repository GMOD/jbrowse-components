import { useEffect, useMemo, useRef, useState } from 'react'

import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import {
  getContainingTrack,
  getContainingView,
  getSession,
  isSessionModelWithWidgets,
  notEmpty,
} from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import ArcTooltipContents from './ArcTooltipContents'
import { featureToArcData, getArcSelectedColor } from './arcUtils'

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
  const [selectedArcId, setSelectedArcId] = useState<string | null>(null)

  const svgRef = useRef<SVGSVGElement>(null)
  const arcMapRef = useRef<Map<string, ArcData>>(new Map())
  const pathMapRef = useRef<Map<string, SVGPathElement>>(new Map())
  const selectedArcIdRef = useRef<string | null>(null)
  selectedArcIdRef.current = selectedArcId

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

    // Build lookup maps
    const arcMap = new Map<string, ArcData>()
    const pathMap = new Map<string, SVGPathElement>()

    // Event handlers (shared across all paths)
    const handleMouseEnter = (event: MouseEvent) => {
      const target = event.currentTarget as SVGPathElement
      const id = target.dataset.id
      if (id) {
        const arc = arcMap.get(id)
        if (arc) {
          setHoverInfo({ arc, x: event.clientX, y: event.clientY })
          const isSelected = id === selectedArcIdRef.current
          // Add hover shading - increase opacity and stroke width
          target.setAttribute('opacity', '1')
          target.setAttribute(
            'stroke-width',
            String(arc.strokeWidth + (isSelected ? 4 : 2)),
          )
        }
      }
    }
    const handleMouseLeave = (event: MouseEvent) => {
      const target = event.currentTarget as SVGPathElement
      const id = target.dataset.id
      if (id) {
        const arc = arcMap.get(id)
        if (arc) {
          const isSelected = id === selectedArcIdRef.current
          // Restore styling (selected or original)
          target.setAttribute('opacity', '0.7')
          if (isSelected) {
            target.setAttribute('stroke', getArcSelectedColor(arc.strand))
            target.setAttribute('stroke-width', String(arc.strokeWidth + 3))
          } else {
            target.setAttribute('stroke', arc.stroke)
            target.setAttribute('stroke-width', String(arc.strokeWidth))
          }
        }
      }
      setHoverInfo(null)
    }
    const handleClick = (event: MouseEvent) => {
      const target = event.currentTarget as SVGPathElement
      const id = target.dataset.id
      if (id) {
        setSelectedArcId(prev => (prev === id ? null : id))
        const arc = arcMap.get(id)
        if (arc) {
          const session = getSession(model)
          if (isSessionModelWithWidgets(session)) {
            const featureWidget = session.addWidget(
              'BaseFeatureWidget',
              'baseFeature',
              {
                featureData: {
                  uniqueId: arc.id,
                  refName: arc.refName,
                  start: arc.start,
                  end: arc.end,
                  type: 'junction',
                  strand: arc.strand,
                  score: arc.score,
                  length: arc.end - arc.start,
                },
                view: getContainingView(model),
                track: getContainingTrack(model),
              },
            )
            session.showWidget(featureWidget)
          }
        }
      }
    }

    // Create paths directly in DOM (sorted by score so high-scoring arcs render on top)
    const sortedArcs = [...arcs].sort((a, b) => a.score - b.score)
    for (const arc of sortedArcs) {
      arcMap.set(arc.id, arc)
      const path = document.createElementNS(SVGNS, 'path')
      path.setAttribute('d', arc.path)
      path.setAttribute('stroke', arc.stroke)
      path.setAttribute('stroke-width', String(arc.strokeWidth))
      path.setAttribute('fill', 'none')
      path.setAttribute('opacity', '0.7')
      path.setAttribute('pointer-events', 'stroke')
      path.setAttribute('cursor', 'pointer')
      path.dataset.id = arc.id
      path.addEventListener('mouseenter', handleMouseEnter)
      path.addEventListener('mouseleave', handleMouseLeave)
      path.addEventListener('click', handleClick)
      pathMap.set(arc.id, path)
      svg.append(path)
    }

    arcMapRef.current = arcMap
    pathMapRef.current = pathMap

    // Cleanup
    return () => {
      while (svg.firstChild) {
        const child = svg.firstChild as SVGPathElement
        child.removeEventListener('mouseenter', handleMouseEnter)
        child.removeEventListener('mouseleave', handleMouseLeave)
        child.removeEventListener('click', handleClick)
        child.remove()
      }
    }
  }, [arcs, model])

  // Update selected arc styling when selection changes
  useEffect(() => {
    const pathMap = pathMapRef.current
    const arcMap = arcMapRef.current
    for (const [id, path] of pathMap) {
      const arc = arcMap.get(id)
      if (arc) {
        if (id === selectedArcId) {
          // Selected: darker stroke color
          path.setAttribute('stroke', getArcSelectedColor(arc.strand))
          path.setAttribute('stroke-width', String(arc.strokeWidth + 3))
        } else {
          // Not selected: restore original
          path.setAttribute('stroke', arc.stroke)
          path.setAttribute('stroke-width', String(arc.strokeWidth))
        }
      }
    }
  }, [selectedArcId])

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
