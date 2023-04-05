import React, { useRef } from 'react'
import { observer } from 'mobx-react'
import { getEnv } from 'mobx-state-tree'
import { makeStyles } from 'tss-react/mui'

// locals
import { BreakpointViewModel } from '../model'
import Overlay from './Overlay'

const useStyles = makeStyles()(theme => ({
  viewDivider: {
    background: theme.palette.secondary.main,
    height: 3,
  },
  container: {
    display: 'grid',
  },
  overlay: {
    display: 'flex',
    width: '100%',
    gridArea: '1/1',
    '& path': {
      cursor: 'crosshair',
      fill: 'none',
    },
  },
  content: {
    gridArea: '1/1',
  },
}))

const BreakpointSplitView = observer(function ({
  model,
}: {
  model: BreakpointViewModel
}) {
  const { classes } = useStyles()
  const { views } = model
  const { pluginManager } = getEnv(model)
  const ref = useRef(null)

  return (
    <div>
      <div className={classes.container}>
        <div className={classes.content}>
          <div style={{ position: 'relative' }}>
            {views.map((view, idx) => {
              const { ReactComponent } = pluginManager.getViewType(view.type)
              const viewComponent = (
                <ReactComponent key={view.id} model={view} />
              )
              if (idx === views.length - 1) {
                return viewComponent
              }
              return [
                viewComponent,
                <div
                  key={`${view.id}-divider`}
                  className={classes.viewDivider}
                />,
              ]
            })}
          </div>
        </div>
        <div className={classes.overlay}>
          <svg
            ref={ref}
            style={{
              width: '100%',
              zIndex: 10,
              pointerEvents: model.interactToggled ? undefined : 'none',
            }}
          >
            {model.matchedTracks.map(track => (
              // note: we must pass ref down, because the child component
              // needs to getBoundingClientRect on the this components SVG,
              // and we cannot rely on using getBoundingClientRect in this
              // component to make sure this works because if it gets
              // shifted around by another element, this will not re-render
              // necessarily
              <Overlay
                parentRef={ref}
                key={track.configuration.trackId}
                model={model}
                trackId={track.configuration.trackId}
              />
            ))}
          </svg>
        </div>
      </div>
    </div>
  )
})

export default BreakpointSplitView
