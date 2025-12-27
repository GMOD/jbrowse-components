import { LoadingEllipses } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import type { LinearArcDisplayModel } from '../model'

const useStyles = makeStyles()(theme => ({
  loading: {
    backgroundColor: theme.palette.background.default,
    backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 5px, ${theme.palette.action.disabledBackground} 5px, ${theme.palette.action.disabledBackground} 10px)`,
    position: 'absolute',
    bottom: 0,
    height: 50,
    width: 300,
    right: 0,
    pointerEvents: 'none',
    textAlign: 'center',
  },
}))

const LoadingBar = observer(function LoadingBar({
  model,
}: {
  model: LinearArcDisplayModel
}) {
  const { classes } = useStyles()
  const { statusMessage } = model
  return (
    <div className={classes.loading}>
      <LoadingEllipses message={statusMessage} />
    </div>
  )
})

export default LoadingBar
