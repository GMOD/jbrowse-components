import { lazy } from 'react'

import { ProgressChip, ViewLoadingScreen } from '@jbrowse/core/ui'
import { getEnv } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { MultiLevelRubberband } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import BreakpointSplitViewOverlay from './BreakpointSplitViewOverlay.tsx'
import Header from './Header.tsx'
import { VIEW_DIVIDER_HEIGHT } from './overlayGeometry.ts'

import type { BreakpointViewModel } from '../model.ts'

const BreakpointSplitViewImportForm = lazy(
  () => import('./BreakpointSplitViewImportForm.tsx'),
)

const useStyles = makeStyles()(theme => ({
  viewDivider: {
    background: theme.palette.secondary.main,
    // the overlay stacks view tops with this same constant, so they can't drift
    height: VIEW_DIVIDER_HEIGHT,
  },
  // CSS grid with both children at gridArea 1/1 makes the overlay sit exactly
  // on top of the views without any JS coordinate translation. The downside is
  // that the overlay becomes a DOM sibling of the views rather than a child, so
  // the wheel handler cannot use event.target to identify which view was
  // scrolled — it must fall back to a querySelectorAll + Y-coordinate scan.
  container: {
    display: 'grid',
  },
  content: {
    gridArea: '1/1',
  },
  rel: {
    position: 'relative',
  },
  rubberbandContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  rubberbandDiv: {
    width: '100%',
    background: theme.palette.action.disabledBackground,
    height: 15,
    '&:hover': {
      background: theme.palette.action.selected,
    },
  },
}))

const BreakpointSplitViewLevels = observer(function BreakpointSplitViewLevels({
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
        {views.flatMap((view, idx) => {
          const { ReactComponent } = pluginManager.getViewType(view.type)
          const viewComponent = <ReactComponent key={view.id} model={view} />
          return idx === views.length - 1
            ? [viewComponent]
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

const BreakpointSplitView = observer(function BreakpointSplitView({
  model,
}: {
  model: BreakpointViewModel
}) {
  const { classes } = useStyles()
  const { showLoading, showImportForm, loadingMessage, loadingProgress } = model

  // showLoading first, and both branches outside the rubberband container, so
  // the three phases read the same way here as in LGV/dotplot/synteny. The two
  // are disjoint (showLoading needs hasSomethingToShow and no error, which is
  // exactly what showImportForm negates), so the order is legibility, not logic.
  if (showLoading) {
    return (
      <ViewLoadingScreen
        message={loadingMessage}
        fraction={loadingProgress}
        source={model.loadingSource}
      />
    )
  } else if (showImportForm) {
    return <BreakpointSplitViewImportForm model={model} />
  } else {
    return (
      <div className={classes.rubberbandContainer}>
        {model.showHeader ? <Header model={model} /> : null}
        <MultiLevelRubberband
          model={model}
          ControlComponent={<div className={classes.rubberbandDiv} />}
        />
        <div className={classes.container}>
          <BreakpointSplitViewLevels model={model} />
          <BreakpointSplitViewOverlay model={model} />
        </div>
        {/* The overlay-feature fetch runs with the panels already drawn and
         usable — the links between them are what is missing — so it gets the
         corner chip rather than a scrim, the same call `DisplayChrome` and the
         comparative views make for work over live content. Outside the grid
         container, whose children are stacked at 1/1: the chip anchors itself
         against `rubberbandContainer`, the only positioned ancestor here. */}
        {model.fetchStatus.message ? (
          <ProgressChip status={model.fetchStatus} />
        ) : null}
      </div>
    )
  }
})

export default BreakpointSplitView
