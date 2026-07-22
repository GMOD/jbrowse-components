import { Suspense, lazy } from 'react'

import { observer } from 'mobx-react'

import type { DotplotViewModel } from '../model.ts'
import type { DotplotInteraction } from './useDotplotInteraction.ts'

const DotplotCoordTooltip = lazy(() => import('./DotplotCoordTooltip.tsx'))

const DotplotTooltips = observer(function DotplotTooltips({
  model,
  interaction,
}: {
  model: DotplotViewModel
  interaction: DotplotInteraction
}) {
  const { hovering, validSelect, anchor, pointer, dx, selecting } = interaction
  return (
    <Suspense fallback={null}>
      {hovering && validSelect && pointer ? (
        <DotplotCoordTooltip
          model={model}
          point={pointer}
          placement={dx < 0 ? 'left' : 'right'}
        />
      ) : null}
      {selecting && anchor ? (
        <DotplotCoordTooltip
          model={model}
          point={anchor}
          placement={dx < 0 ? 'right' : 'left'}
        />
      ) : null}
    </Suspense>
  )
})

export default DotplotTooltips
