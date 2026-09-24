import { ComparativeTooltip } from '@jbrowse/synteny-core'
import { observer } from 'mobx-react'

import { locstr } from './util.ts'

import type { DotplotViewModel } from '../model.ts'
import type {
  DotplotInteraction,
  PointerSample,
} from './useDotplotInteraction.ts'

const DotplotTooltips = observer(function DotplotTooltips({
  model,
  interaction,
}: {
  model: DotplotViewModel
  interaction: DotplotInteraction
}) {
  const { validSelect, anchor, pointer, dx, selecting } = interaction
  const { hview, vview, hoveredTooltipLines } = model
  const coordLines = (point: PointerSample) => [
    `x - ${locstr(hview.fromScreenPx(point.x), hview)}`,
    `y - ${locstr(vview.fromScreenPx(point.y), vview)}`,
  ]
  // One tooltip at the pointer, and the alignment under it wins: its own two
  // locations are strictly more than the cursor coordinates they would replace.
  // The hover is cleared at pointerdown, so `dx` is 0 whenever the feature lines
  // are the ones showing — the drag placement below applies to the coordinates
  // only, and the two can never be live at once.
  const pointerLines =
    hoveredTooltipLines ??
    (validSelect && pointer ? coordLines(pointer) : undefined)
  return (
    <>
      {pointer && pointerLines ? (
        <ComparativeTooltip
          lines={pointerLines}
          clientPoint={{ x: pointer.clientX, y: pointer.clientY }}
          placement={dx < 0 ? 'left' : 'right'}
        />
      ) : null}
      {selecting && anchor ? (
        <ComparativeTooltip
          lines={coordLines(anchor)}
          clientPoint={{ x: anchor.clientX, y: anchor.clientY }}
          placement={dx < 0 ? 'right' : 'left'}
        />
      ) : null}
    </>
  )
})

export default DotplotTooltips
