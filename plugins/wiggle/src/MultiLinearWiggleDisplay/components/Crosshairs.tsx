import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import type { WiggleDisplayModel } from '../model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()(theme => ({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    pointerEvents: 'none',
    zIndex: 800,
  },
  horizontalLine: {
    position: 'absolute',
    left: 0,
    height: 1,
    backgroundColor: theme.palette.text.primary,
    pointerEvents: 'none',
  },
}))

const Crosshairs = observer(function ({
  mouseY,
  model,
}: {
  mouseY: number
  model: WiggleDisplayModel
}) {
  const { classes } = useStyles()
  const { height } = model
  const { width } = getContainingView(model) as LinearGenomeViewModel

  return (
    <div className={classes.container} style={{ width, height }}>
      <div
        className={classes.horizontalLine}
        style={{ transform: `translateY(${mouseY}px)`, width }}
      />
    </div>
  )
})

export default Crosshairs
