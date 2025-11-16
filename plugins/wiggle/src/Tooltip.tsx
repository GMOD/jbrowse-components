import { Suspense } from 'react'

import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import { YSCALEBAR_LABEL_OFFSET } from './util'

import type { Feature } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  hoverVertical: {
    background: '#333',
    border: 'none',
    width: 1,
    height: '100%',
    top: YSCALEBAR_LABEL_OFFSET,
    cursor: 'default',
    position: 'absolute',
    pointerEvents: 'none',
  },
})

type Coord = [number, number]

// forwardRef component for the tooltip, the ref is used for measuring
// the size of the tooltip
export type TooltipContentsComponent = React.ForwardRefExoticComponent<
  { feature: Feature; model: any } & React.RefAttributes<HTMLDivElement>
>

const Tooltip = observer(function Tooltip({
  model,
  height,
  clientMouseCoord,
  offsetMouseCoord,
  TooltipContents,
}: {
  model: { featureUnderMouse?: Feature }
  height: number
  clientMouseCoord: Coord
  offsetMouseCoord: Coord
  TooltipContents: TooltipContentsComponent
}) {
  const { featureUnderMouse } = model
  const { classes } = useStyles()

  const x = clientMouseCoord[0] + 5
  const y = clientMouseCoord[1]
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
          height: height - YSCALEBAR_LABEL_OFFSET * 2,
        }}
      />
    </>
  ) : null
})

export default Tooltip
