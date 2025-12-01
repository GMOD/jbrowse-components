import type React from 'react'
import { Suspense } from 'react'

import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { observer } from 'mobx-react'
import { makeStyles } from '@jbrowse/core/util/tss-react'

import type { Feature } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  hoverVertical: {
    background: '#333',
    border: 'none',
    width: 1,
    height: '100%',
    cursor: 'default',
    position: 'absolute',
    pointerEvents: 'none',
  },
})

type Coord = [number, number]

export type TooltipContentsComponent = React.ForwardRefExoticComponent<
  { feature: Feature; model: any } & React.RefAttributes<HTMLDivElement>
>

const Tooltip = observer(function Tooltip({
  model,
  height,
  clientMouseCoord,
  offsetMouseCoord,
  clientRect,
  TooltipContents,
  useClientY,
}: {
  model: { featureUnderMouse?: Feature }
  useClientY?: boolean
  height: number
  clientMouseCoord: Coord
  offsetMouseCoord: Coord
  clientRect?: DOMRect
  TooltipContents: TooltipContentsComponent
}) {
  const { featureUnderMouse } = model
  const { classes } = useStyles()

  const x = clientMouseCoord[0] + 5
  const y = useClientY ? clientMouseCoord[1] : clientRect?.top || 0
  return featureUnderMouse ? (
    <>
      <Suspense fallback={null}>
        <BaseTooltip clientPoint={{ x, y }}>
          <TooltipContents model={model} feature={featureUnderMouse} />
        </BaseTooltip>
      </Suspense>

      <div
        className={classes.hoverVertical}
        style={{
          left: offsetMouseCoord[0],
          height: height,
        }}
      />
    </>
  ) : null
})

export default Tooltip
