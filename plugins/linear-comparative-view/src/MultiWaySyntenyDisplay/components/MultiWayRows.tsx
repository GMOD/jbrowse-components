import { observer } from 'mobx-react'

import { LaneBands, LaneHeaders, LaneTicks } from './LaneChrome.tsx'
import { LaneGlyphs } from './LaneGlyphs.tsx'
import { GroupHighlight, GroupRibbons, LinkRibbons } from './Ribbons.tsx'

import type { MultiWaySyntenyDisplayModel } from '../model.ts'

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
      <GroupRibbons model={model} />
      <LinkRibbons model={model} />
      <LaneTicks model={model} />
      <LaneGlyphs model={model} exportSVG={exportSVG} />
      <GroupHighlight model={model} />
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
