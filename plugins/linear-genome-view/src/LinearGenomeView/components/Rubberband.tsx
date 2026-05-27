import { useRef } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import RangeSelectOverlay from './RangeSelectOverlay.tsx'
import { useRangeSelect } from './useRangeSelect.ts'

import type { LinearGenomeViewModel } from '../index.ts'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()({
  rubberbandControl: {
    cursor: 'crosshair',
    width: '100%',
    minHeight: 8,
    zIndex: 825,
  },
})

const Rubberband = observer(function Rubberband({
  model,
  ControlComponent = <div />,
}: {
  model: LGV
  ControlComponent?: React.ReactElement
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { classes } = useStyles()
  const { stickyViewHeaders, rubberbandTop } = model
  const range = useRangeSelect(ref, model)

  return (
    <>
      <RangeSelectOverlay model={model} range={range} menuOffsetX={10} />
      <div
        data-testid="rubberband_controls"
        className={classes.rubberbandControl}
        style={
          stickyViewHeaders
            ? { top: rubberbandTop, position: 'sticky' }
            : undefined
        }
        ref={ref}
        onMouseDown={range.mouseDown}
        onMouseMove={range.mouseMove}
        onMouseOut={range.mouseOut}
      >
        {ControlComponent}
      </div>
    </>
  )
})

export default Rubberband
