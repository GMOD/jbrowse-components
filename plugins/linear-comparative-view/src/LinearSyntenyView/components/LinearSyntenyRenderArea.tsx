import { useRef } from 'react'

import { ResizeHandle } from '@jbrowse/core/ui'
import { getEnv } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import ChromeLegend from '@jbrowse/display-kit/ChromeLegend'
import AnchorIcon from '@mui/icons-material/Anchor'
import { Chip, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'
import { Fragment } from 'react/jsx-runtime'

import LevelSyntenyCanvas from '../../LinearSyntenyViewHelper/LevelSyntenyCanvas.tsx'

import type { LinearSyntenyViewModel } from '../model.ts'
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
  // beside the row's floating zoom controls (LGV `MiniControls`, five small
  // icon buttons at the row's top right), not over them
  anchorBadge: {
    position: 'absolute',
    top: 4,
    right: 150,
    zIndex: 100,
  },
})

const View = observer(function View({ view }: { view: LinearGenomeViewModel }) {
  const { pluginManager } = getEnv(view)
  const { ReactComponent } = pluginManager.getViewType(view.type)
  return <ReactComponent model={view} />
})

/**
 * The anchor row, marked on the row itself. Rows in a synteny stack are
 * launched with their LGV header hidden, so without this the only places that
 * say which row drives are the header toggle's tooltip and a radio two menus
 * deep — and the row that keeps moving on its own is the one the reader is
 * trying to identify.
 */
const AnchorBadge = observer(function AnchorBadge({
  model,
  row,
}: {
  model: LinearSyntenyViewModel
  row: number
}) {
  const { classes } = useStyles()
  return model.followSynteny && model.followAnchorIndex === row ? (
    <Tooltip title="Anchor row: the other rows follow this one">
      <Chip
        className={classes.anchorBadge}
        size="small"
        color="primary"
        icon={<AnchorIcon />}
        label="Anchor"
      />
    </Tooltip>
  ) : null
})

const LinearSyntenyRenderArea = observer(function LinearSyntenyRenderArea({
  model,
}: {
  model: LinearSyntenyViewModel
}) {
  const { classes } = useStyles()
  const { views } = model

  return (
    <div className={classes.container}>
      {views.map((view, i) => (
        <Fragment key={view.id}>
          {/* Keyed by the LEVEL, not by its position under this view, so a
              replaced level cannot inherit the previous one's mounted subtree —
              its canvas (a re-init on a reused element, which is what a WebGPU
              swap chain cannot survive) or its in-flight pointer state (a drag
              anchor, a hovered contig). Nothing reaches that today: `setViews`
              is the only action that replaces levels and it replaces the views
              too, so the Fragment key above already remounts this. `views`
              otherwise only grows and shrinks at the end, which leaves every
              surviving row's level where it was.

              Asserted, not optional-chained: `reconcileLevels` keeps one level
              per gap, so `i > 0` has one, and `LevelSection` reads the same
              element the same way. An `?.` here would not survive a missing
              level either — it spells the key `undefined`, which is React for
              unkeyed, and the band still throws on `level.height` a moment
              later. */}
          {i > 0 ? (
            <LevelSection
              key={model.levels[i - 1]!.id}
              model={model}
              levelIdx={i - 1}
            />
          ) : null}
          <div className={classes.wrapper}>
            <View view={view} />
            <AnchorBadge model={model} row={i} />
          </div>
        </Fragment>
      ))}
    </div>
  )
})

const LevelSection = observer(function LevelSection({
  model,
  levelIdx,
}: {
  model: LinearSyntenyViewModel
  levelIdx: number
}) {
  const { classes } = useStyles()
  const drag = useRef({ alone: false, from: [] as number[], moved: 0 })
  const level = model.levels[levelIdx]!

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
        {/* One legend for the whole view, hosted in the topmost synteny band
          (the "helper" area) where the color-coded ribbons it describes are
          actually drawn */}
        {levelIdx === 0 ? <ChromeLegend model={model} /> : null}
      </div>
      {/* Sizes every band, not this one gap (see `resizeAllLevelHeights`),
        and Alt sizes this one alone, which is the only way back to a stack
        whose bands differ on purpose. */}
      <ResizeHandle
        bar
        onPointerDown={event => {
          drag.current = {
            alone: event.altKey,
            from: model.levels.map(l => l.height),
            moved: 0,
          }
        }}
        onDrag={n => {
          const d = drag.current
          if (d.alone) {
            level.resizeHeight(n)
          } else {
            d.moved = model.resizeAllLevelHeights(d.moved + n, levelIdx, d.from)
          }
        }}
        title={
          model.levels.length > 1
            ? 'Drag to resize every synteny band (hold Alt to resize just this one)'
            : 'Drag to resize the synteny band'
        }
      />
    </>
  )
})

const Overlays = observer(function Overlays({
  model,
  level,
}: {
  model: LinearSyntenyViewModel
  level: number
}) {
  const { classes } = useStyles()
  // The caller only ever renders one of these per level that exists, so the
  // index is in range by construction — asserted rather than guarded, as the
  // neighbouring `views[i]!` reads are.
  const levelImpl = model.levels[level]!

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

export default LinearSyntenyRenderArea
