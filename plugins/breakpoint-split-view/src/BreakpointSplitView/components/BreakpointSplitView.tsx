import React from 'react'
import { observer } from 'mobx-react'
import { getEnv } from 'mobx-state-tree'
import { makeStyles } from 'tss-react/mui'

// locals
import { BreakpointViewModel } from '../model'
import BreakpointSplitViewOverlay from './BreakpointSplitViewOverlay'

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
      <div style={{ position: 'relative' }}>
        {views.map((view, idx) => {
          const { ReactComponent } = pluginManager.getViewType(view.type)
          const viewComponent = <ReactComponent key={view.id} model={view} />
          if (idx === views.length - 1) {
            return viewComponent
          }
          return [
            viewComponent,
            <div key={`${view.id}-divider`} className={classes.viewDivider} />,
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
      <div className={classes.container}>
        <BreakpointSplitViewLevels model={model} />
        <BreakpointSplitViewOverlay model={model} />
      </div>
    </div>
  )
})

export default BreakpointSplitView
