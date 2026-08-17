import { ResizeHandle } from '@jbrowse/core/ui'
import { getEnv } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { ColorByLegend } from '@jbrowse/synteny-core'
import { observer } from 'mobx-react'
import { Fragment } from 'react/jsx-runtime'

import { asSyntenyModel } from '../../LinearSyntenyView/model.ts'
import LevelSyntenyCanvas from '../../LinearSyntenyViewHelper/LevelSyntenyCanvas.tsx'

import type { LinearSyntenyViewHelperModel } from '../../LinearSyntenyViewHelper/stateModelFactory.ts'
import type { LinearComparativeViewModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

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

const View = observer(function View({ view }: { view: LinearGenomeViewModel }) {
  const { pluginManager } = getEnv(view)
  const { ReactComponent } = pluginManager.getViewType(view.type)
  return <ReactComponent model={view} />
})

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
  const legendModel =
    levelIdx === 0 && syntenyModel?.showColorLegend ? syntenyModel : undefined

  return (
    <>
      {/* The band's height comes from the level, not from what happens to be
        drawn in it: the canvas is absolutely positioned and the legend floats,
        so the only in-flow children are the per-track overlays. A level with no
        synteny track is a legal state (the import form launches one, and hiding
        the last track reaches it too), and without this the band reserved 0px
        while its canvas still painted level.height over the genome row below. */}
      <div className={classes.wrapper} style={{ height: level.height }}>
        <div className={classes.container}>
          <LevelSyntenyCanvas model={level} />
          <Overlays model={model} level={levelIdx} />
        </div>
        {legendModel ? (
          <ColorByLegend
            colorBy={legendModel.uniformColorBy}
            trackChips={legendModel.colorLegendChips}
            cigarOps={legendModel.presentCigarKinds}
            attributeRanges={legendModel.attributeRanges}
            alpha={legendModel.alpha}
            onClose={() => {
              legendModel.setShowColorLegend(false)
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
  // Annotated, not asserted. `levels` is declared `IAnyModelType` to break a
  // type cycle (see the view's model), so an element off it is `any` and
  // everything read from one is too — silently. Naming the type here is what
  // gets `linearSyntenyDisplays` back as the `LinearSyntenyDisplayModel[]` its
  // getter already declares, with no cast on the read.
  const levelImpl: LinearSyntenyViewHelperModel = model.levels[level]

  // The same list the level uploads and renders geometry for, rather than a
  // second walk over `tracks` taking `displays[0]`: those two disagree the
  // moment a track carries anything but exactly one synteny display, and then
  // a ribbon paints on the shared canvas with no overlay to hover or
  // right-click it (or the reverse). Keyed by display id for the same reason.
  return (
    <>
      {levelImpl.linearSyntenyDisplays.map(display => (
        <div
          className={classes.overlay}
          key={display.id}
          style={{
            height: display.height,
            overflow: 'hidden',
          }}
        >
          <display.RenderingComponent model={display} />
        </div>
      ))}
    </>
  )
})

export default LinearComparativeRenderArea
