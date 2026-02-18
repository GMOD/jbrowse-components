import { getConf } from '@jbrowse/core/configuration'
import { ResizeHandle } from '@jbrowse/core/ui'
import { getEnv } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'
import { Fragment } from 'react/jsx-runtime'

import type { LinearComparativeViewModel } from '../model.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface TrackEntry {
  configuration: AnyConfigurationModel
  displays: {
    height: number
    RenderingComponent: React.FC<{ model: unknown }>
  }[]
}

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
    '&:hover': {
      background: '#aaa',
    },
  },
})

function View({ view }: { view: LinearGenomeViewModel }) {
  const { pluginManager } = getEnv(view)
  const { ReactComponent } = pluginManager.getViewType(view.type)!
  return <ReactComponent model={view} />
}

const LinearComparativeRenderArea = observer(
  function LinearComparativeRenderArea({
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
                  onDrag={n => {
                    const level = levels[i - 1]
                    level?.setHeight(level.height + n)
                    return undefined
                  }}
                  className={classes.resizeHandle}
                />
              </>
            ) : null}
            <View view={view} />
          </Fragment>
        ))}
      </div>
    )
  },
)

const Overlays = observer(function Overlays({
  model,
  level,
}: {
  model: LinearComparativeViewModel
  level: number
}) {
  const { classes } = useStyles()
  const levelImpl = model.levels[level]!

  const tracks = levelImpl.tracks as TrackEntry[]
  return (
    <>
      {tracks.map(track => {
        const display = track.displays[0]
        const RenderingComponent = display?.RenderingComponent
        const trackId = getConf(track, 'trackId') as string
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
