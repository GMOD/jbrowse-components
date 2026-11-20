import { makeStyles } from '@jbrowse/core/util/tss-react'
import useMeasure from '@jbrowse/core/util/useMeasure'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { noMatchingTracksMessage } from '../../TrackTable/components/util.ts'
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
  emptyMessage,
}: {
  model: HierarchicalTrackSelectorModel
  emptyMessage?: string
}) {
  const { classes } = useStyles()
  const [ref, { height }] = useMeasure('height')
  const message =
    model.rows.length > 0
      ? undefined
      : model.trackTable.allRows.length > 0
        ? noMatchingTracksMessage
        : emptyMessage
  return (
    <>
      <HierarchicalHeader model={model} />
      <div ref={ref} className={classes.treeContainer}>
        {message ? (
          <Typography
            variant="body2"
            color="textSecondary"
            className={classes.empty}
          >
            {message}
          </Typography>
        ) : height ? (
          <HierarchicalTree height={height} model={model} />
        ) : null}
      </div>
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
  const emptyMessage =
    model.trackList !== 'all' && model.listedTrackConfigurations.length === 0
      ? emptyListMessage[model.trackList]
      : undefined
  return (
    <div
      className={classes.container}
      style={{ height: `calc(100% - ${toolbarHeight}px)` }}
    >
      <TrackSelectorToggles model={model} />
      {model.showTable ? (
        <TrackTable model={model} emptyMessage={emptyMessage} />
      ) : (
        <TrackTree model={model} emptyMessage={emptyMessage} />
      )}
    </div>
  )
})

export default HierarchicalTrackSelector
