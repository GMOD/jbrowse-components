import ScrollZoomToggle from '@jbrowse/core/ui/ScrollZoomToggle'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { HEADER_BAR_HEIGHT } from '../consts.ts'
import HeaderClearHighlightButton from './HeaderClearHighlightButton.tsx'
import HeaderPanControls from './HeaderPanControls.tsx'
import HeaderRegionWidth from './HeaderRegionWidth.tsx'
import HeaderTrackSelectorButton from './HeaderTrackSelectorButton.tsx'
import HeaderZoomControls from './HeaderZoomControls.tsx'
import OverviewScalebar from './OverviewScalebar.tsx'
import SearchBox from './SearchBox.tsx'

import type { LinearGenomeViewModel } from '../index.ts'

const useStyles = makeStyles()({
  headerBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    // a floor, not a height. The constant was written onto this row by #4237 so
    // the sticky offsets summing it would be true, and the row's own content
    // reaches it at a 28px root font — the search box measures 48.13 there —
    // after which a fixed height holds the row smaller than what is in it
    minHeight: HEADER_BAR_HEIGHT,
  },
  spacer: {
    flexGrow: 1,
  },
})

const Controls = observer(function Controls({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.headerBar}>
      <HeaderTrackSelectorButton model={model} />
      <ScrollZoomToggle model={model} />
      <div className={classes.spacer} />
      <HeaderPanControls model={model} />
      <SearchBox model={model} />
      <HeaderClearHighlightButton model={model} />
      <HeaderRegionWidth model={model} />
      <HeaderZoomControls model={model} />
      <div className={classes.spacer} />
    </div>
  )
})

const LinearGenomeViewHeader = observer(function LinearGenomeViewHeader({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const { hideHeader, hideHeaderOverview } = model
  return !hideHeader ? (
    hideHeaderOverview ? (
      <Controls model={model} />
    ) : (
      <OverviewScalebar model={model}>
        <Controls model={model} />
      </OverviewScalebar>
    )
  ) : null
})

export default LinearGenomeViewHeader
