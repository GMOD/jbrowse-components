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
