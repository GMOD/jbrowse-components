import { persistentScrollbarStyle } from '@jbrowse/core/ui/persistentScrollbarStyle'
import { useScrollPortHeightVar } from '@jbrowse/core/util/hooks'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import ViewStack from './ViewStack.tsx'

import type { SessionWithFocusedViewAndDrawerWidgets } from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  container: {
    height: '100%',
    width: '100%',
    gridRow: 'components',
    overflowY: 'auto',
    ...persistentScrollbarStyle(theme),
  },
}))

interface Props {
  session: SessionWithFocusedViewAndDrawerWidgets
}

const ClassicViewsContainer = observer(function ClassicViewsContainer({
  session,
}: Props) {
  const { classes } = useStyles()
  const { views } = session
  const ref = useScrollPortHeightVar()

  return (
    <div ref={ref} className={classes.container}>
      <ViewStack views={views} session={session} />
    </div>
  )
})

export default ClassicViewsContainer
