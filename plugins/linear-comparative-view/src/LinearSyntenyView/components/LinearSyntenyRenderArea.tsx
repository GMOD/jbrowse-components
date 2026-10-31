import { useRef } from 'react'

import { ResizeHandle } from '@jbrowse/core/ui'
import { getEnv } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import ChromeLegend from '@jbrowse/display-kit/ChromeLegend'
import AnchorIcon from '@mui/icons-material/Anchor'
import { Chip, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'
import { Fragment } from 'react/jsx-runtime'

import { SyntenyLevel } from '../../LinearSyntenyViewHelper/SyntenyLevel.tsx'

import type { LinearSyntenyViewModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()({
  container: {
    display: 'grid',
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
              anchor, a hovered contig). `removeRow` replaces an interior
              level and `reverseRows` reorders them, so a row's level can
              change while its view survives.

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
  const drag = useRef({ alone: false, from: [] as number[] })
  const level = model.levels[levelIdx]!

  return (
    <>
      <SyntenyLevel level={level}>
        {/* one legend for the whole view, in the topmost band */}
        {levelIdx === 0 ? <ChromeLegend model={model} /> : null}
      </SyntenyLevel>
      {/* Sizes every band, not this one gap (see `resizeAllLevelHeights`),
        and Alt sizes this one alone, which is the only way back to a stack
        whose bands differ on purpose. */}
      <ResizeHandle
        bar
        onPointerDown={event => {
          drag.current = {
            alone: event.altKey,
            from: model.levels.map(l => l.height),
          }
        }}
        // the distance from the press, the bands scaled from where they were
        value={0}
        onChange={distance => {
          const { alone, from } = drag.current
          if (alone) {
            level.resizeHeight(from[levelIdx]! + distance - level.height)
          } else {
            model.resizeAllLevelHeights(distance, levelIdx, from)
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

export default LinearSyntenyRenderArea
