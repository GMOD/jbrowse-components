import { getConf } from '@jbrowse/core/configuration'
import { ResizeHandle } from '@jbrowse/core/ui'
import { getEnv } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'
import { Fragment } from 'react/jsx-runtime'

import LevelSyntenyCanvas from '../../LinearSyntenyViewHelper/LevelSyntenyCanvas.tsx'

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

const useStyles = makeStyles()(() => ({
  container: {
    display: 'grid',
  },
  overlay: {
    zIndex: 100,
    gridArea: '1/1',
    pointerEvents: 'none',
  },
  resizeHandle: {
    height: 4,
    background: '#ccc',
  },
  wrapper: {
    position: 'relative',
  },
}))

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
    const { views } = model

    return (
      <div className={classes.container}>
        {views.map((view, i) => (
          <Fragment key={view.id}>
            {i > 0 ? <LevelSection model={model} levelIdx={i - 1} /> : null}
            <View view={view} />
          </Fragment>
        ))}
      </div>
    )
  },
)

const LevelSection = observer(function LevelSection({
  model,
  levelIdx,
}: {
  model: LinearComparativeViewModel
  levelIdx: number
}) {
  const { classes } = useStyles()
  const level = model.levels[levelIdx]!

  return (
    <>
      <div className={classes.wrapper}>
        <div className={classes.container}>
          <LevelSyntenyCanvas model={level} />
          <Overlays model={model} level={levelIdx} />
        </div>
      </div>
      <ResizeHandle
        onDrag={n => {
          level.setHeight(level.height + n)
          return undefined
        }}
        className={classes.resizeHandle}
      />
    </>
  )
})

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
