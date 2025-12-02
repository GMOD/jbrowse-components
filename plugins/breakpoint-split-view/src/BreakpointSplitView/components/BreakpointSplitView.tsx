import { getEnv } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import BreakpointSplitViewOverlay from './BreakpointSplitViewOverlay'
import Header from './Header'

import type { BreakpointViewModel } from '../model'

const useStyles = makeStyles()(theme => ({
  viewDivider: {
    background: theme.palette.secondary.main,
    height: 3,
  },
  container: {
    display: 'grid',
  },
  content: {
    gridArea: '1/1',
  },
  rel: {
    position: 'relative',
  },
}))

const BreakpointSplitViewLevels = observer(function ({
  model,
}: {
  model: BreakpointViewModel
}) {
  const { classes } = useStyles()
  const { views } = model
  const { pluginManager } = getEnv(model)
  return (
    <div className={classes.content}>
      <div className={classes.rel}>
        {views.map((view, idx) => {
          const { ReactComponent } = pluginManager.getViewType(view.type)!
          const viewComponent = <ReactComponent key={view.id} model={view} />
          return idx === views.length - 1
            ? viewComponent
            : [
                viewComponent,
                <div
                  key={`${view.id}-divider`}
                  className={classes.viewDivider}
                />,
              ]
        })}
      </div>
    </div>
  )
})

const BreakpointSplitView = observer(function ({
  model,
}: {
  model: BreakpointViewModel
}) {
  const { classes } = useStyles()
  return (
    <div>
      {model.showHeader ? <Header model={model} /> : null}
      <div className={classes.container}>
        <BreakpointSplitViewLevels model={model} />
        <BreakpointSplitViewOverlay model={model} />
      </div>
    </div>
  )
})

export default BreakpointSplitView
