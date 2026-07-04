import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import ViewContainer from './ViewContainer.tsx'

import type { SessionWithFocusedViewAndDrawerWidgets } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  container: {
    height: '100%',
    width: '100%',
    gridRow: 'components',
    overflowY: 'auto',
  },
  spacer: {
    height: 300,
  },
})

interface Props {
  session: SessionWithFocusedViewAndDrawerWidgets
}

const ClassicViewsContainer = observer(function ClassicViewsContainer({
  session,
}: Props) {
  const { classes } = useStyles()
  const { views } = session

  return (
    <div className={classes.container}>
      {views.map(view => (
        <ViewContainer key={view.id} view={view} session={session} />
      ))}
      <div className={classes.spacer} />
    </div>
  )
})

export default ClassicViewsContainer
