import { Suspense, lazy } from 'react'

import type { DotplotViewModel } from '../model.ts'

const TooltipWhereClicked = lazy(() => import('./DotplotTooltipClick.tsx'))
const TooltipWhereMouseovered = lazy(
  () => import('./DotplotTooltipMouseover.tsx'),
)

type Coord = [number, number] | undefined

interface DotplotTooltipsProps {
  model: DotplotViewModel
  mouseOvered: boolean
  validSelect: boolean
  mouserect: Coord
  mouserectClient: Coord
  xdistance: number
  mousedown: Coord
  mousedownClient: Coord
  ydistance: number
}

export default function DotplotTooltips({
  model,
  mouseOvered,
  validSelect,
  mouserect,
  mouserectClient,
  xdistance,
  mousedown,
  mousedownClient,
  ydistance,
}: DotplotTooltipsProps) {
  return (
    <>
      {mouseOvered && validSelect ? (
        <Suspense fallback={null}>
          <TooltipWhereMouseovered
            model={model}
            mouserect={mouserect}
            mouserectClient={mouserectClient}
            xdistance={xdistance}
          />
        </Suspense>
      ) : null}
      {validSelect ? (
        <Suspense fallback={null}>
          <TooltipWhereClicked
            model={model}
            mousedown={mousedown}
            mousedownClient={mousedownClient}
            xdistance={xdistance}
            ydistance={ydistance}
          />
        </Suspense>
      ) : null}
    </>
  )
}
