import { Suspense, lazy } from 'react'

import { observer } from 'mobx-react'

import { locstr } from './util.ts'

import type { DotplotViewModel } from '../model.ts'
import type {
  DotplotInteraction,
  PointerSample,
} from './useDotplotInteraction.ts'

const DotplotTooltip = lazy(() => import('./DotplotTooltip.tsx'))

const DotplotTooltips = observer(function DotplotTooltips({
  model,
  interaction,
}: {
  model: DotplotViewModel
  interaction: DotplotInteraction
}) {
  const { hovering, validSelect, anchor, pointer, dx, selecting } = interaction
  const { hview, vview, viewHeight, hoveredTooltipLines } = model
  // The cursor's own position on both axes. The v axis lays out bottom-up, so
  // its pixel is flipped through the plot height first.
  const coordLines = (point: PointerSample) => [
    `x - ${locstr(point.x, hview)}`,
    `y - ${locstr(viewHeight - point.y, vview)}`,
  ]
  // One tooltip at the pointer, and the alignment under it wins: its own two
  // locations are strictly more than the cursor coordinates they would replace.
  // The hover is cleared at pointerdown, so `dx` is 0 whenever the feature lines
  // are the ones showing — the drag placement below applies to the coordinates
  // only, and the two can never be live at once.
  const pointerLines =
    hoveredTooltipLines ??
    (hovering && validSelect && pointer ? coordLines(pointer) : undefined)
  return (
    <Suspense fallback={null}>
      {pointer && pointerLines ? (
        <DotplotTooltip
          lines={pointerLines}
          point={pointer}
          placement={dx < 0 ? 'left' : 'right'}
        />
      ) : null}
      {selecting && anchor ? (
        <DotplotTooltip
          lines={coordLines(anchor)}
          point={anchor}
          placement={dx < 0 ? 'right' : 'left'}
        />
      ) : null}
    </Suspense>
  )
})

export default DotplotTooltips
