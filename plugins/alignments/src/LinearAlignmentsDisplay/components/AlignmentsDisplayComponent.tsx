import { Suspense, useRef, useState } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import type { LinearAlignmentsDisplayModel } from '../model.ts'

type Coord = [number, number]

const useStyles = makeStyles()({
  display: {
    position: 'relative',
    whiteSpace: 'nowrap',
    textAlign: 'left',
    width: '100%',
    minHeight: '100%',
  },
})

const AlignmentsDisplayComponent = observer(
  function AlignmentsDisplayComponent({
    model,
  }: {
    model: LinearAlignmentsDisplayModel
  }) {
    const { classes } = useStyles()
    const ref = useRef<HTMLDivElement>(null)
    const [clientRect, setClientRect] = useState<DOMRect>()
    const [offsetMouseCoord, setOffsetMouseCoord] = useState<Coord>([0, 0])
    const [clientMouseCoord, setClientMouseCoord] = useState<Coord>([0, 0])
    const { TooltipComponent, DisplayMessageComponent, height } = model
    return (
      <div
        ref={ref}
        data-testid={`display-${getConf(model, 'displayId')}`}
        className={classes.display}
        onMouseMove={event => {
          if (!ref.current) {
            return
          }
          const rect = ref.current.getBoundingClientRect()
          const { left, top } = rect
          setOffsetMouseCoord([event.clientX - left, event.clientY - top])
          setClientMouseCoord([event.clientX, event.clientY])
          setClientRect(rect)
        }}
      >
        <DisplayMessageComponent model={model} />
        <Suspense fallback={null}>
          <TooltipComponent
            model={model}
            height={height}
            offsetMouseCoord={offsetMouseCoord}
            clientMouseCoord={clientMouseCoord}
            clientRect={clientRect}
            mouseCoord={offsetMouseCoord}
          />
        </Suspense>
      </div>
    )
  },
)

export default AlignmentsDisplayComponent
