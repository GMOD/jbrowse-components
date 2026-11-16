import { makeStyles } from '@jbrowse/core/util/tss-react'
import useMeasure from '@jbrowse/core/util/useMeasure'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import HierarchicalFab from './HierarchicalFab.tsx'
import TrackSelectorToggles from './TrackSelectorToggles.tsx'
import TrackTable from './TrackTable.tsx'
import HierarchicalHeader from './tree/HierarchicalHeader.tsx'
import HierarchicalTree from './tree/HierarchicalTree.tsx'

import type { HierarchicalTrackSelectorModel } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  container: {
    display: 'flex',
    flexDirection: 'column',
  },
  treeContainer: {
    flex: 1,
    minHeight: 0,
  },
  empty: {
    margin: theme.spacing(1, 2),
  },
}))

const emptyListMessage = {
  favorites: 'No favorite tracks yet. Add one from a track’s menu.',
  recent: 'No recently used tracks yet.',
}

const TrackTree = observer(function TrackTree({
  model,
}: {
  model: HierarchicalTrackSelectorModel
}) {
  const { classes } = useStyles()
  const [ref, { height }] = useMeasure('height')
  const { trackList, listedTrackConfigurations } = model
  return (
    <>
      <HierarchicalHeader model={model} />
      {trackList !== 'all' && listedTrackConfigurations.length === 0 ? (
        <Typography
          variant="body2"
          color="textSecondary"
          className={classes.empty}
        >
          {emptyListMessage[trackList]}
        </Typography>
      ) : null}
      <div ref={ref} className={classes.treeContainer}>
        {height ? <HierarchicalTree height={height} model={model} /> : null}
      </div>
      <HierarchicalFab model={model} />
    </>
  )
})

const HierarchicalTrackSelector = observer(function HierarchicalTrackSelector({
  model,
  toolbarHeight = 0,
}: {
  model: HierarchicalTrackSelectorModel
  toolbarHeight?: number
}) {
  const { classes } = useStyles()
  return (
    <div
      className={classes.container}
      style={{ height: `calc(100% - ${toolbarHeight}px)` }}
    >
      <TrackSelectorToggles model={model} />
      {model.showTable ? (
        <TrackTable model={model} />
      ) : (
        <TrackTree model={model} />
      )}
    </div>
  )
})

export default HierarchicalTrackSelector
