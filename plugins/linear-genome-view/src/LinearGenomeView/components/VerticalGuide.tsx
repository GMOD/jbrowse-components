import { stringify } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { GuideLabel } from '../../shared/coordLabels.tsx'

import type { LinearGenomeViewModel } from '../index.ts'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()({
  guide: {
    pointerEvents: 'none',
    height: '100%',
    width: 1,
    position: 'absolute',
    left: 0,
    background: 'red',
    zIndex: 1001,
  },
})

const VerticalGuide = observer(function VerticalGuide({
  model,
  coordX,
}: {
  model: LGV
  coordX: number
}) {
  const { classes } = useStyles()
  const { width, stickyViewHeaders, rubberbandTop } = model

  return (
    <>
      <GuideLabel
        coordX={coordX}
        viewWidth={width}
        stickyTop={stickyViewHeaders ? rubberbandTop : undefined}
      >
        {stringify(model.pxToBp(coordX))}
      </GuideLabel>
      <div
        className={classes.guide}
        style={{ transform: `translateX(${coordX}px)` }}
      />
    </>
  )
})

export default VerticalGuide
