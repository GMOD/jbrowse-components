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
  return (
    <Suspense fallback={null}>
      {/* One tooltip at the pointer, and the alignment under it wins: its own
          two locations are strictly more than the cursor coordinates they would
          replace. The hover is cleared at pointerdown, so the feature arm and
          the drag arms below can never be live at once. */}
      {pointer && hoveredTooltipLines ? (
        <DotplotTooltip
          lines={hoveredTooltipLines}
          point={pointer}
          placement="right"
        />
      ) : hovering && validSelect && pointer ? (
        <DotplotTooltip
          lines={coordLines(pointer)}
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
