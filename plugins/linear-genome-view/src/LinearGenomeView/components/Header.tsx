import ScrollZoomToggle from '@jbrowse/core/ui/ScrollZoomToggle'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import useMeasure from '@jbrowse/core/util/useMeasure'
import { observer } from 'mobx-react'

import { HEADER_BAR_HEIGHT } from '../consts.ts'
import { headerFit } from '../headerFit.ts'
import HeaderClearHighlightButton, {
  highlightedDisplays,
} from './HeaderClearHighlightButton.tsx'
import HeaderPanControls from './HeaderPanControls.tsx'
import HeaderRegionWidth from './HeaderRegionWidth.tsx'
import HeaderTrackSelectorButton from './HeaderTrackSelectorButton.tsx'
import HeaderZoomControls from './HeaderZoomControls.tsx'
import OverviewScalebar from './OverviewScalebar.tsx'
import SearchBox, { searchBoxWidth } from './SearchBox.tsx'

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
  // the row itself, not `model.width`: what the pieces below have to fit into
  // is this box, and the offset between it and the view's measured width
  // differs between the app's view container, an embedded host and a synteny
  // row
  const [ref, { width }] = useMeasure('width')
  const highlighted = highlightedDisplays(model)
  const fit = headerFit({
    width,
    searchBoxPx: searchBoxWidth(model.coarseVisibleLocStrings),
    clearHighlight: highlighted.length > 0,
  })
  return (
    <div className={classes.headerBar} ref={ref}>
      <HeaderTrackSelectorButton
        model={model}
        indent={fit.trackSelectorIndent}
      />
      <ScrollZoomToggle model={model} iconOnly={!fit.scrollZoomLabel} />
      <div className={classes.spacer} />
      <HeaderPanControls model={model} compact={!fit.panButtonSpacing} />
      <SearchBox model={model} />
      <HeaderClearHighlightButton highlighted={highlighted} />
      {fit.regionWidth ? <HeaderRegionWidth model={model} /> : null}
      <HeaderZoomControls model={model} showSlider={fit.zoomSlider} />
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
