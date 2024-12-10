import { getConf } from '@jbrowse/core/configuration'
import { ResizeHandle } from '@jbrowse/core/ui'
import { getEnv } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import { Fragment } from 'react/jsx-runtime'
import { makeStyles } from 'tss-react/mui'

import type { LinearComparativeViewModel } from '../model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()({
  container: {
    display: 'grid',
  },
  overlay: {
    zIndex: 100,
    gridArea: '1/1',
  },
  resizeHandle: {
    height: 4,
    background: '#ccc',
  },
})

function View({ view }: { view: LinearGenomeViewModel }) {
  const { pluginManager } = getEnv(view)
  const { ReactComponent } = pluginManager.getViewType(view.type)!
  return <ReactComponent model={view} />
}

const LinearComparativeRenderArea = observer(function ({
  model,
}: {
  model: LinearComparativeViewModel
}) {
  const { classes } = useStyles()
  const { views, levels } = model

  return (
    <div className={classes.container}>
      {views.map((view, i) => (
        <Fragment key={view.id}>
          {i > 0 ? (
            <>
              <div className={classes.container}>
                <Overlays model={model} level={i - 1} />
              </div>
              <ResizeHandle
                onDrag={n =>
                  levels[i - 1]?.setHeight((levels[i - 1]?.height || 0) + n)
                }
                className={classes.resizeHandle}
              />
            </>
          ) : null}
          <View view={view} />
        </Fragment>
      ))}
    </div>
  )
})

const Overlays = observer(function ({
  model,
  level,
}: {
  model: LinearComparativeViewModel
  level: number
}) {
  const { classes } = useStyles()
  return (
    <>
      {model.levels[level]?.tracks.map(track => {
        const [display] = track.displays
        const { RenderingComponent } = display
        const trackId = getConf(track, 'trackId')
        return RenderingComponent ? (
          <div
            className={classes.overlay}
            key={trackId}
            style={{
              height: display.height,
              overflow: 'hidden',
            }}
          >
            <RenderingComponent model={display} />
          </div>
        ) : null
      })}
    </>
  )
})

export default LinearComparativeRenderArea
