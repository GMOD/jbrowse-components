import { observer } from 'mobx-react'

import { LaneBands, LaneHeaders, LaneTicks } from './LaneChrome.tsx'
import { LaneGlyphs } from './LaneGlyphs.tsx'
import { GroupHighlight, GroupRibbons, LinkRibbons } from './Ribbons.tsx'

import type { MultiWaySyntenyDisplayModel } from '../model.ts'

const ScrolledStack = observer(function ScrolledStack({
  model,
  children,
}: {
  model: MultiWaySyntenyDisplayModel
  children: React.ReactNode
}) {
  return <g transform={`translate(${model.dragOffsetPx} 0)`}>{children}</g>
})

/**
 * The stack, back to front.
 *
 * Every layer is a walk over `model.laneStack` and reads what it needs off the
 * model itself, so this is the z-order and nothing else — which is the one
 * thing about an SVG stack that has to be readable in one place.
 *
 * The bands go down first because they exist to cover the view's gridlines; the
 * hover outline goes over the glyphs it outlines; the headers go last so a
 * ribbon never crosses a label.
 *
 * Everything between the bands and the headers is laid out against the
 * scroll offset of the last settle and translated by however far the view has
 * scrolled since — so a pan re-renders one attribute, and the six lanes'
 * elements re-render on a settle, a zoom or new data. The bands and headers
 * are chrome pinned to the track, not content, and stay put.
 */
const MultiWayRows = observer(function MultiWayRows({
  model,
  exportSVG,
}: {
  model: MultiWaySyntenyDisplayModel
  exportSVG?: boolean
}) {
  if (!model.anchorAssembly) {
    return null
  }
  const body = (
    <>
      <LaneBands model={model} />
      <ScrolledStack model={model}>
        <GroupRibbons model={model} />
        <LinkRibbons model={model} />
        <LaneTicks model={model} />
        <LaneGlyphs model={model} exportSVG={exportSVG} />
        <GroupHighlight model={model} />
      </ScrolledStack>
      <LaneHeaders model={model} />
    </>
  )
  return exportSVG ? (
    body
  ) : (
    <svg width={model.canvasWidth} height={model.height}>
      {body}
    </svg>
  )
})

export default MultiWayRows
