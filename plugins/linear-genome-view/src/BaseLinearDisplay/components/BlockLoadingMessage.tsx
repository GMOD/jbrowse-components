import { LoadingEllipses } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'
import { getParent } from 'mobx-state-tree'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()(theme => {
  const bg = theme.palette.action.disabledBackground
  return {
    loading: {
      paddingLeft: '0.6em',
      backgroundColor: theme.palette.background.default,
      backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 5px, ${bg} 5px, ${bg} 10px)`,
      textAlign: 'center',
    },
  }
})

const BlockLoadingMessage = observer(function ({
  model,
}: {
  model: { status?: string }
}) {
  const { classes } = useStyles()
  const { status: blockStatus } = model
  const { message: displayStatus } = getParent<{ message?: string }>(model, 2)
  const status = displayStatus || blockStatus
  return (
    <div className={classes.loading}>
      <LoadingEllipses message={status} />
    </div>
  )
})

export default BlockLoadingMessage
