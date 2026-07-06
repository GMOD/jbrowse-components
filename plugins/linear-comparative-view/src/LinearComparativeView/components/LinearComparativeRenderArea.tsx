import { getConf } from '@jbrowse/core/configuration'
import { ResizeHandle } from '@jbrowse/core/ui'
import { getEnv } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { ColorByLegend, coerceColorBy } from '@jbrowse/synteny-core'
import { observer } from 'mobx-react'
import { Fragment } from 'react/jsx-runtime'

import { asSyntenyModel } from '../../LinearSyntenyView/model.ts'
import LevelSyntenyCanvas from '../../LinearSyntenyViewHelper/LevelSyntenyCanvas.tsx'

import type { LinearComparativeViewModel } from '../model.ts'
import type { AbstractTrackModel } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// The structural surface of the display objects this file consumes. We
// don't depend on the full BaseDisplayModel typing because `levels` is an
// MST array of pluggable types late-resolved at runtime.
interface TrackDisplay {
  height: number
  RenderingComponent: React.FC<{ model: TrackDisplay }>
}

const useStyles = makeStyles()({
  container: {
    display: 'grid',
  },
  overlay: {
    zIndex: 100,
    gridArea: '1/1',
    pointerEvents: 'none',
  },
  wrapper: {
    position: 'relative',
  },
})

function View({ view }: { view: LinearGenomeViewModel }) {
  const { pluginManager } = getEnv(view)
  const { ReactComponent } = pluginManager.getViewType(view.type)
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
  const syntenyModel = asSyntenyModel(model)
  // One legend for the whole view, hosted in the topmost synteny band (the
  // "helper" area) where the color-coded ribbons it describes are actually drawn
  const showLegend = levelIdx === 0 && !!syntenyModel?.showColorLegend

  return (
    <>
      <div className={classes.wrapper}>
        <div className={classes.container}>
          <LevelSyntenyCanvas model={level} />
          <Overlays model={model} level={levelIdx} />
        </div>
        {syntenyModel && showLegend ? (
          <ColorByLegend
            colorBy={coerceColorBy(syntenyModel.colorBy)}
            cigarOps={syntenyModel.presentCigarKinds}
            alpha={syntenyModel.alpha}
            onClose={() => {
              syntenyModel.setShowColorLegend(false)
            }}
          />
        ) : null}
      </div>
      <ResizeHandle
        bar
        onDrag={n => {
          level.setHeight(level.height + n)
          return undefined
        }}
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

  return (
    <>
      {(levelImpl.tracks as AbstractTrackModel[]).map(track => {
        const display = track.displays[0] as TrackDisplay | undefined
        const trackId = getConf(track, 'trackId') as string
        return display ? (
          <div
            className={classes.overlay}
            key={trackId}
            style={{
              height: display.height,
              overflow: 'hidden',
            }}
          >
            <display.RenderingComponent model={display} />
          </div>
        ) : null
      })}
    </>
  )
})

export default LinearComparativeRenderArea
