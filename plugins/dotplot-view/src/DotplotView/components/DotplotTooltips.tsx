import { Suspense, lazy } from 'react'

import type { DotplotInteraction } from './useDotplotInteraction.ts'
import type { DotplotViewModel } from '../model.ts'

const DotplotCoordTooltip = lazy(() => import('./DotplotCoordTooltip.tsx'))

export default function DotplotTooltips({
  model,
  interaction,
}: {
  model: DotplotViewModel
  interaction: DotplotInteraction
}) {
  const {
    mouseOvered,
    validSelect,
    mouserect,
    mouserectClient,
    xdistance,
    mousedown,
    mouseDownClient,
    selection,
  } = interaction
  return (
    <Suspense fallback={null}>
      {mouseOvered && validSelect && mouserect ? (
        <DotplotCoordTooltip
          model={model}
          coord={mouserect}
          clientCoord={mouserectClient}
          placement={xdistance < 0 ? 'left' : 'right'}
        />
      ) : null}
      {selection && mousedown ? (
        <DotplotCoordTooltip
          model={model}
          coord={mousedown}
          clientCoord={mouseDownClient}
          placement={xdistance < 0 ? 'right' : 'left'}
        />
      ) : null}
    </Suspense>
  )
}
