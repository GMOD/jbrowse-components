import { makeStyles } from '@jbrowse/core/util/tss-react'
import { FormGroup } from '@mui/material'
import { observer } from 'mobx-react'

import HeaderPanControls from './HeaderPanControls'
import HeaderRegionWidth from './HeaderRegionWidth'
import HeaderTrackSelectorButton from './HeaderTrackSelectorButton'
import HeaderZoomControls from './HeaderZoomControls'
import OverviewScalebar from './OverviewScalebar'
import SearchBox from './SearchBox'
import { HEADER_BAR_HEIGHT } from '../consts'

import type { LinearGenomeViewModel } from '..'

const useStyles = makeStyles()({
  headerBar: {
    display: 'flex',
    height: HEADER_BAR_HEIGHT,
  },
  headerForm: {
    flexWrap: 'nowrap',
    marginRight: 7,
  },
  spacer: {
    flexGrow: 1,
  },
})

const Controls = function ({ model }: { model: LinearGenomeViewModel }) {
  const { classes } = useStyles()
  return (
    <div className={classes.headerBar}>
      <HeaderTrackSelectorButton model={model} />
      <div className={classes.spacer} />
      <FormGroup row className={classes.headerForm}>
        <HeaderPanControls model={model} />
        <SearchBox model={model} />
      </FormGroup>
      <HeaderRegionWidth model={model} />
      <HeaderZoomControls model={model} />
      <div className={classes.spacer} />
    </div>
  )
}

const LinearGenomeViewHeader = observer(function ({
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
